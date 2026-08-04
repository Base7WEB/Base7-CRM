import os

BASE_DIR    = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
SESSION_DIR = os.path.join(BASE_DIR, "data", "whatsapp_session")
WHATSAPP_URL = "https://web.whatsapp.com"

# Seletores usados para detectar estado da página. Vários candidatos por robustez
# (o WhatsApp Web muda o DOM com frequência, mesmo padrão de fallback do scraper.py).
SELETORES_CONECTADO = [
    "div[data-testid='chat-list']",
    "div#pane-side",
    "div[aria-label='Lista de conversas']",
    "div[aria-label='Chat list']",
]
SELETORES_QR = [
    "canvas[aria-label]",
    "div[data-testid='qrcode'] canvas",
    "div[data-ref] canvas",
    "canvas",
]


async def abrir_contexto(playwright):
    """Abre (ou reabre) o contexto persistente do Chromium logado no WhatsApp Web.

    headless=False propositalmente: o WhatsApp Web detecta e desloga sessões
    headless com frequência. Ver docs/WHATSAPP.md para o requisito operacional
    (a janela do Chromium precisa ficar aberta na máquina em uso).
    """
    os.makedirs(SESSION_DIR, exist_ok=True)
    context = await playwright.chromium.launch_persistent_context(
        SESSION_DIR,
        headless=False,
        viewport={"width": 1280, "height": 860},
        locale="pt-BR",
        args=["--disable-blink-features=AutomationControlled"],
    )
    page = context.pages[0] if context.pages else await context.new_page()
    return context, page
