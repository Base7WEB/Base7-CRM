import json
import os

BASE_DIR       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
DATA_DIR       = os.path.join(BASE_DIR, "data")
TEMPLATES_FILE = os.path.join(DATA_DIR, "templates.json")

os.makedirs(DATA_DIR, exist_ok=True)


def ler_templates():
    """Retorna { etapa: [{id, nome, texto, categoria}] }. {} se ainda não configurado."""
    if not os.path.exists(TEMPLATES_FILE):
        return {}
    with open(TEMPLATES_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return {}


def salvar_templates(templates):
    with open(TEMPLATES_FILE, "w", encoding="utf-8") as f:
        json.dump(templates, f, ensure_ascii=False, indent=2)
