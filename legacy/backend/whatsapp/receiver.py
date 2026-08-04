import re

from . import utils

# Seletores best-effort (mesmo espírito de fallback do scraper.py) — o DOM do
# WhatsApp Web muda com frequência, então cada extração tenta múltiplos seletores.
SELETORES_ITENS_CHAT = [
    "div[aria-label='Lista de conversas'] div[role='listitem']",
    "div[aria-label='Chat list'] div[role='listitem']",
    "div#pane-side div[role='listitem']",
]
SELETORES_NAO_LIDA = [
    "span[aria-label*='unread']",
    "span[aria-label*='não lida']",
    "span[aria-label*='nao lida']",
]
SELETORES_NOME_CHAT = [
    "span[dir='auto'][title]",
]
SELETORES_MENSAGEM_RECEBIDA = [
    "div.message-in .selectable-text span",
    "div.message-in span.selectable-text",
]

LIMITE_CHATS_POR_CICLO = 20


async def listar_chats(page):
    for sel in SELETORES_ITENS_CHAT:
        try:
            itens = await page.query_selector_all(sel)
            if itens:
                return itens
        except Exception:
            continue
    return []


async def _tem_nao_lida(item):
    for sel in SELETORES_NAO_LIDA:
        try:
            if await item.query_selector(sel):
                return True
        except Exception:
            continue
    return False


async def _extrair_telefone(item):
    """O WhatsApp Web guarda o JID do contato (ex.: 5511999999999@c.us) em
    atributos internos do item da lista — mais confiável que abrir o chat."""
    try:
        html = await item.inner_html()
        m = re.search(r"(\d{10,15})@c\.us", html)
        if m:
            return m.group(1)
    except Exception:
        pass
    return None


async def _extrair_nome(item):
    for sel in SELETORES_NOME_CHAT:
        try:
            el = await item.query_selector(sel)
            if el:
                titulo = await el.get_attribute("title")
                if titulo:
                    return titulo.strip()
        except Exception:
            continue
    return None


async def _abrir_e_extrair_ultima_mensagem(page, item):
    try:
        await item.click()
        await utils.delay(1, 1.5)
    except Exception:
        return None

    for sel in SELETORES_MENSAGEM_RECEBIDA:
        try:
            elementos = await page.query_selector_all(sel)
            if elementos:
                texto = await elementos[-1].inner_text()
                if texto:
                    return texto.strip()
        except Exception:
            continue
    return None


async def verificar_novas_mensagens(page):
    """Varre a lista de conversas por chats com indicador de não lida.

    Retorna uma lista de dicts {telefone, nome, texto} — uma entrada por chat
    não lido processado neste ciclo. Nunca lança exceção: falhas pontuais de
    seletor resultam apenas em menos resultados, não em erro para o chamador.
    """
    resultados = []
    try:
        itens = await listar_chats(page)
    except Exception:
        return resultados

    for item in itens[:LIMITE_CHATS_POR_CICLO]:
        try:
            if not await _tem_nao_lida(item):
                continue

            telefone = await _extrair_telefone(item)
            nome     = await _extrair_nome(item)
            texto    = await _abrir_e_extrair_ultima_mensagem(page, item)

            if texto:
                resultados.append({"telefone": telefone, "nome": nome, "texto": texto})
            await utils.delay(0.5, 1)
        except Exception:
            continue

    return resultados
