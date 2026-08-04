import re
import urllib.parse

from . import utils

SELETORES_CAIXA_TEXTO = [
    "div[contenteditable='true'][data-tab='10']",
    "footer div[contenteditable='true']",
    "div[aria-placeholder='Digite uma mensagem']",
    "div[aria-placeholder='Type a message']",
]
SELETORES_BOTAO_ENVIAR = [
    "button[aria-label='Enviar']",
    "button[aria-label='Send']",
    "span[data-icon='send']",
]
MARCADORES_NUMERO_INVALIDO = [
    "número de telefone compartilhado",
    "phone number shared via url is invalid",
    "telefone inválido",
]


async def enviar_mensagem(page, telefone, texto):
    """Abre o chat do telefone via deep-link do WhatsApp Web e envia a mensagem.

    Retorna {"ok": bool, "erro": str|None}.
    """
    numero = re.sub(r"\D", "", telefone or "")
    if not numero:
        return {"ok": False, "erro": "Telefone inválido"}

    url = f"https://web.whatsapp.com/send?phone={numero}&text={urllib.parse.quote(texto or '')}"
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await utils.delay(2, 3)

    if await _numero_invalido(page):
        return {"ok": False, "erro": "Número não encontrado no WhatsApp"}

    caixa = await _aguardar_caixa_texto(page)
    if not caixa:
        return {"ok": False, "erro": "Não foi possível abrir a conversa (chat não carregou)"}

    await utils.delay(0.5, 1)
    if not await _clicar_enviar(page):
        await page.keyboard.press("Enter")

    await utils.delay(1, 1.5)
    return {"ok": True, "erro": None}


async def verificar_numero(page, telefone):
    """Verifica se um número existe no WhatsApp, sem enviar mensagem."""
    numero = re.sub(r"\D", "", telefone or "")
    if not numero:
        return {"existe": False, "erro": "Telefone inválido"}

    url = f"https://web.whatsapp.com/send?phone={numero}"
    await page.goto(url, wait_until="domcontentloaded", timeout=30000)
    await utils.delay(2, 3)

    if await _numero_invalido(page):
        return {"existe": False, "erro": None}

    caixa = await _aguardar_caixa_texto(page, timeout=8000)
    return {"existe": bool(caixa), "erro": None}


async def _numero_invalido(page):
    try:
        txt = (await page.inner_text("body")).lower()
    except Exception:
        return False
    return any(m in txt for m in MARCADORES_NUMERO_INVALIDO)


async def _aguardar_caixa_texto(page, timeout=15000):
    for sel in SELETORES_CAIXA_TEXTO:
        try:
            el = await page.wait_for_selector(sel, timeout=timeout)
            if el:
                return el
        except Exception:
            continue
    return None


async def _clicar_enviar(page):
    for sel in SELETORES_BOTAO_ENVIAR:
        try:
            el = await page.query_selector(sel)
            if el:
                await el.click()
                return True
        except Exception:
            continue
    return False
