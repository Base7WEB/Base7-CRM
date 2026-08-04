import asyncio
import random
import re


async def delay(mn, mx):
    await asyncio.sleep(random.uniform(mn, mx))


def normalizar_telefone(telefone, ddi_padrao="55"):
    """Remove espaços/parênteses/hífens e normaliza DDI/DDD de um telefone brasileiro.

    Números com 10-11 dígitos (DDD+telefone, sem DDI) recebem o DDI padrão.
    Números com 12-13 dígitos são tratados como já contendo o DDI.
    """
    if not telefone:
        return ""
    digitos = re.sub(r"\D", "", telefone)
    if not digitos:
        return ""
    digitos = digitos.lstrip("0")
    if len(digitos) in (10, 11):
        return ddi_padrao + digitos
    return digitos


def formatar_telefone_exibicao(telefone_normalizado):
    """Formata um telefone normalizado (com DDI) para exibição: (XX) XXXXX-XXXX."""
    digitos = re.sub(r"\D", "", telefone_normalizado or "")
    if digitos.startswith("55") and len(digitos) in (12, 13):
        digitos = digitos[2:]
    if len(digitos) == 11:
        return f"({digitos[:2]}) {digitos[2:7]}-{digitos[7:]}"
    if len(digitos) == 10:
        return f"({digitos[:2]}) {digitos[2:6]}-{digitos[6:]}"
    return telefone_normalizado or ""
