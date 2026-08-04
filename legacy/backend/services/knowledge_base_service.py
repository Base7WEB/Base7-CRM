import json
import os

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
DATA_DIR = os.path.join(BASE_DIR, "data")
KB_FILE  = os.path.join(DATA_DIR, "knowledge_base.json")

os.makedirs(DATA_DIR, exist_ok=True)

CAMPOS_PADRAO = {
    "sobre":        "",
    "produtos":     "",
    "servicos":     "",
    "precos":       "",
    "diferenciais": "",
    "faq":          "",
    "objecoes":     "",
    "politicas":    "",
}


def ler_base_conhecimento():
    if not os.path.exists(KB_FILE):
        return dict(CAMPOS_PADRAO)
    with open(KB_FILE, "r", encoding="utf-8") as f:
        try:
            dados = json.load(f)
        except json.JSONDecodeError:
            dados = {}
    return {**CAMPOS_PADRAO, **dados}


def salvar_base_conhecimento(dados):
    atual = ler_base_conhecimento()
    atual.update({k: v for k, v in dados.items() if k in CAMPOS_PADRAO})
    with open(KB_FILE, "w", encoding="utf-8") as f:
        json.dump(atual, f, ensure_ascii=False, indent=2)
    return atual


def formatar_para_prompt(kb=None):
    """Formata a base como texto para inclusão em prompts da IA (usado a partir do Bloco 14)."""
    kb = kb or ler_base_conhecimento()
    secoes = [
        ("Sobre a empresa", kb.get("sobre")),
        ("Produtos", kb.get("produtos")),
        ("Serviços", kb.get("servicos")),
        ("Preços", kb.get("precos")),
        ("Diferenciais", kb.get("diferenciais")),
        ("Perguntas frequentes", kb.get("faq")),
        ("Objeções comuns e como responder", kb.get("objecoes")),
        ("Políticas comerciais", kb.get("politicas")),
    ]
    partes = [f"{titulo}:\n{texto}" for titulo, texto in secoes if texto and texto.strip()]
    return "\n\n".join(partes) if partes else "(nenhuma informação comercial cadastrada ainda)"
