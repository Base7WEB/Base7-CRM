from .utils import normalizar_telefone

# whatsapp_manager NÃO é reexportado aqui de propósito: manager.py importa
# playwright, e este pacote precisa continuar importável (para normalizar_telefone)
# mesmo em ambientes sem Playwright instalado. Quem precisar do manager deve
# importar diretamente de whatsapp.manager.
__all__ = ["normalizar_telefone"]
