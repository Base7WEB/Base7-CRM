import json
import os
import re

try:
    import anthropic
    CLAUDE_LIB_OK = True
except ImportError:
    CLAUDE_LIB_OK = False

from services.config_service import ler_config

MODELO_PADRAO = "claude-haiku-4-5-20251001"


def disponivel():
    return CLAUDE_LIB_OK


def obter_api_key():
    return ler_config().get("claude_api_key", "") or os.environ.get("ANTHROPIC_API_KEY", "")


def perguntar_json(prompt, max_tokens=400, modelo=MODELO_PADRAO):
    """Envia o prompt ao Claude e tenta parsear a resposta como JSON.

    Retorna (dados, erro, http_status) — dados é None quando erro não é None,
    espelhando o padrão (resultado, http_status) já usado em whatsapp_service.
    """
    if not CLAUDE_LIB_OK:
        return None, "Instale a biblioteca: pip install anthropic", 503

    api_key = obter_api_key()
    if not api_key:
        return None, "Configure a chave da API Claude em Configurações → IA.", 400

    try:
        cliente = anthropic.Anthropic(api_key=api_key)
        msg = cliente.messages.create(
            model=modelo, max_tokens=max_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        text = msg.content[0].text.strip()
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if not m:
            return None, f"Resposta inesperada da IA: {text[:200]}", 500
        return json.loads(m.group()), None, 200
    except Exception as e:
        return None, str(e), 500
