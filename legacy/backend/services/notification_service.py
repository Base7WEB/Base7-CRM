import json
import os
import uuid
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
DATA_DIR = os.path.join(BASE_DIR, "data")
NOTIFICATIONS_FILE = os.path.join(DATA_DIR, "notifications.json")

os.makedirs(DATA_DIR, exist_ok=True)


def ler_notificacoes():
    if not os.path.exists(NOTIFICATIONS_FILE):
        return []
    with open(NOTIFICATIONS_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def salvar_notificacoes(notificacoes):
    with open(NOTIFICATIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(notificacoes, f, ensure_ascii=False, indent=2)


def criar_notificacao(tipo, titulo, lead_id=None, detalhe=None):
    notificacoes = ler_notificacoes()
    notificacao = {
        "id":        str(uuid.uuid4()),
        "tipo":      tipo,
        "titulo":    titulo,
        "detalhe":   detalhe,
        "lead_id":   lead_id,
        "lida":      False,
        "criada_em": datetime.now().isoformat(timespec="seconds"),
    }
    notificacoes.append(notificacao)
    salvar_notificacoes(notificacoes)
    return notificacao


def marcar_lida(notif_id):
    notificacoes = ler_notificacoes()
    notificacao = next((n for n in notificacoes if n["id"] == notif_id), None)
    if not notificacao:
        return None
    notificacao["lida"] = True
    salvar_notificacoes(notificacoes)
    return notificacao


def marcar_todas_lidas():
    notificacoes = ler_notificacoes()
    for n in notificacoes:
        n["lida"] = True
    salvar_notificacoes(notificacoes)
