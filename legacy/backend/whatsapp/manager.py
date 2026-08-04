import asyncio
import base64
import random
import re

from playwright.async_api import async_playwright

from . import receiver, sender
from .loop import BackgroundLoop
from .session import SELETORES_CONECTADO, SELETORES_QR, WHATSAPP_URL, abrir_contexto

# Status possíveis: desconectado | conectando | aguardando_qr | conectado | erro
STATUS_DESCONECTADO   = "desconectado"
STATUS_CONECTANDO     = "conectando"
STATUS_AGUARDANDO_QR  = "aguardando_qr"
STATUS_CONECTADO      = "conectado"
STATUS_ERRO           = "erro"


class WhatsAppManager:
    """Camada única de interação com o WhatsApp Web via Playwright.

    Nenhum seletor do WhatsApp deve ser usado fora deste pacote — isso permite
    trocar a automação por uma API oficial no futuro sem reescrever o CRM.
    """

    def __init__(self):
        self._bg = BackgroundLoop()
        self._playwright  = None
        self._context     = None
        self._page        = None
        self._monitor_ativo  = False
        self._receiver_ativo = False
        # Serializa todo acesso à página compartilhada (envio, verificação, monitor,
        # fila de campanha e recebimento) — nunca duas navegações simultâneas na
        # mesma sessão (seção 48 do plano).
        self._page_lock   = None

        self.status  = STATUS_DESCONECTADO
        self.numero  = None
        self.erro    = None
        self.qr_base64 = None

        # Callback opcional (telefone, nome, texto) -> None, definido pelo
        # WhatsAppService. Mantém este pacote sem depender de services/.
        self.on_mensagem_recebida = None

    # ── Ciclo de vida ──────────────────────────────────────────────────────

    def start(self):
        """Garante que o event loop de background está rodando."""
        self._bg.start()

    def connect(self):
        """Inicia a conexão de forma assíncrona (não bloqueia a rota Flask).

        O progresso deve ser consultado via get_status()/get_qr() (polling).
        """
        self.start()
        if self.status in (STATUS_CONECTANDO, STATUS_AGUARDANDO_QR, STATUS_CONECTADO):
            return
        self._bg.submit(self._connect_async())

    def disconnect(self):
        self.start()
        try:
            self._bg.run(self._disconnect_async(), timeout=20)
        except Exception as e:
            self.erro = str(e)

    def get_status(self):
        return {
            "status":   self.status,
            "conectado": self.status == STATUS_CONECTADO,
            "numero":   self.numero,
            "erro":     self.erro,
        }

    def get_qr(self):
        return self.qr_base64

    # ── Envio / verificação ──────────────────────────────────────────────

    def get_page(self):
        """Página ativa do WhatsApp Web, usada por sender.py/receiver.py."""
        return self._page

    def run_coro(self, coro, timeout=60):
        """Agenda uma corrotina no loop de background e espera o resultado."""
        self.start()
        return self._bg.run(coro, timeout=timeout)

    def enviar_mensagem(self, telefone, texto):
        if self.status != STATUS_CONECTADO or not self._page:
            return {"ok": False, "erro": "WhatsApp não está conectado"}
        try:
            return self.run_coro(self._enviar_mensagem_async(telefone, texto), timeout=45)
        except Exception as e:
            return {"ok": False, "erro": str(e)}

    def verificar_numero(self, telefone):
        if self.status != STATUS_CONECTADO or not self._page:
            return {"existe": False, "erro": "WhatsApp não está conectado"}
        try:
            return self.run_coro(self._verificar_numero_async(telefone), timeout=30)
        except Exception as e:
            return {"existe": False, "erro": str(e)}

    async def _enviar_mensagem_async(self, telefone, texto):
        async with self._page_lock:
            return await sender.enviar_mensagem(self._page, telefone, texto)

    async def _verificar_numero_async(self, telefone):
        async with self._page_lock:
            return await sender.verificar_numero(self._page, telefone)

    # ── Internos ─────────────────────────────────────────────────────────

    async def _connect_async(self):
        try:
            self.status = STATUS_CONECTANDO
            self.erro   = None
            self._page_lock = asyncio.Lock()
            self._playwright = await async_playwright().start()
            self._context, self._page = await abrir_contexto(self._playwright)
            await self._page.goto(WHATSAPP_URL, wait_until="domcontentloaded", timeout=60000)
            await self._aguardar_login()
        except Exception as e:
            self.status = STATUS_ERRO
            self.erro   = str(e)

    async def _aguardar_login(self):
        self.status = STATUS_AGUARDANDO_QR
        for _ in range(180):  # até ~6 minutos
            if await self._pagina_conectada():
                self.status  = STATUS_CONECTADO
                self.qr_base64 = None
                self.erro    = None
                await self._capturar_numero()
                if not self._monitor_ativo:
                    self._monitor_ativo = True
                    self._bg.submit(self._loop_monitor())
                if not self._receiver_ativo:
                    self._receiver_ativo = True
                    self._bg.submit(self._loop_receiver())
                return
            await self._atualizar_qr()
            await asyncio.sleep(2)
        self.status = STATUS_ERRO
        self.erro   = "Tempo esgotado aguardando leitura do QR Code"

    async def _pagina_conectada(self):
        for sel in SELETORES_CONECTADO:
            try:
                el = await self._page.query_selector(sel)
                if el:
                    return True
            except Exception:
                continue
        return False

    async def _atualizar_qr(self):
        for sel in SELETORES_QR:
            try:
                el = await self._page.query_selector(sel)
                if el:
                    png = await el.screenshot()
                    self.qr_base64 = base64.b64encode(png).decode()
                    return
            except Exception:
                continue

    async def _capturar_numero(self):
        """Melhor esforço: WhatsApp Web não expõe o número de forma direta e estável."""
        try:
            numero = await self._page.evaluate(
                """() => {
                    try {
                        for (const k of Object.keys(window.localStorage)) {
                            if (k.toLowerCase().includes('wid')) {
                                return window.localStorage.getItem(k);
                            }
                        }
                    } catch (e) {}
                    return null;
                }"""
            )
            if numero:
                m = re.search(r"(\d{10,15})", numero)
                if m:
                    self.numero = m.group(1)
        except Exception:
            pass

    async def _loop_monitor(self):
        """Detecta queda de sessão para refletir no status (seção 6 do plano)."""
        try:
            while self.status == STATUS_CONECTADO:
                await asyncio.sleep(15)
                async with self._page_lock:
                    conectado = await self._pagina_conectada()
                if not conectado:
                    self.status = STATUS_DESCONECTADO
                    self.numero = None
                    break
        finally:
            self._monitor_ativo = False

    async def _loop_receiver(self):
        """Verifica periodicamente por mensagens novas (polling do DOM, seção 25)."""
        try:
            while self.status == STATUS_CONECTADO:
                await asyncio.sleep(random.uniform(6, 9))
                if self.status != STATUS_CONECTADO:
                    break
                try:
                    async with self._page_lock:
                        novas = await receiver.verificar_novas_mensagens(self._page)
                    for msg in novas:
                        if self.on_mensagem_recebida:
                            try:
                                self.on_mensagem_recebida(msg.get("telefone"), msg.get("nome"), msg.get("texto"))
                            except Exception as e:
                                print(f"[WhatsApp] Erro no callback de mensagem recebida: {e}")
                except Exception as e:
                    print(f"[WhatsApp] Erro ao verificar mensagens novas: {e}")
        finally:
            self._receiver_ativo = False

    async def _disconnect_async(self):
        try:
            if self._context:
                await self._context.close()
            if self._playwright:
                await self._playwright.stop()
        except Exception:
            pass
        finally:
            self._context = None
            self._page    = None
            self._playwright = None
            self.status  = STATUS_DESCONECTADO
            self.numero  = None
            self.qr_base64 = None
            self._monitor_ativo  = False
            self._receiver_ativo = False


whatsapp_manager = WhatsAppManager()
