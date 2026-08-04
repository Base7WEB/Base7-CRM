import json
import os
import uuid
from datetime import datetime

from services import lead_service
from whatsapp import normalizar_telefone

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
DATA_DIR = os.path.join(BASE_DIR, "data")
CONVERSATIONS_FILE = os.path.join(DATA_DIR, "conversations.json")

os.makedirs(DATA_DIR, exist_ok=True)


def _agora():
    return datetime.now().isoformat(timespec="seconds")


def ler_conversas():
    if not os.path.exists(CONVERSATIONS_FILE):
        return []
    with open(CONVERSATIONS_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def salvar_conversas(conversas):
    with open(CONVERSATIONS_FILE, "w", encoding="utf-8") as f:
        json.dump(conversas, f, ensure_ascii=False, indent=2)


def obter_conversa_por_lead(lead_id):
    return next((c for c in ler_conversas() if c["lead_id"] == lead_id), None)


def obter_conversa_por_telefone(telefone_normalizado):
    return next((c for c in ler_conversas() if c.get("telefone") == telefone_normalizado), None)


def _obter_ou_criar(conversas, lead_id, telefone):
    conv = next((c for c in conversas if c["lead_id"] == lead_id), None)
    if not conv:
        conv = {
            "id": str(uuid.uuid4()),
            "lead_id": lead_id,
            "telefone": telefone,
            "mensagens": [],
            "ultima_analise_ia": None,
        }
        conversas.append(conv)
    return conv


def registrar_mensagem(lead_id, telefone, texto, direcao, campanha_id=None, status="enviada"):
    """direcao: 'enviada' | 'recebida'. Retorna a conversa atualizada."""
    conversas = ler_conversas()
    conv = _obter_ou_criar(conversas, lead_id, telefone)
    msg = {
        "id": str(uuid.uuid4()),
        "data": _agora(),
        "direcao": direcao,
        "texto": texto,
        "status": status,
    }
    if campanha_id:
        msg["campanha_id"] = campanha_id
    conv["mensagens"].append(msg)
    salvar_conversas(conversas)
    return conv


def salvar_analise_ia(lead_id, analise):
    conversas = ler_conversas()
    conv = next((c for c in conversas if c["lead_id"] == lead_id), None)
    if not conv:
        return None
    conv["ultima_analise_ia"] = analise
    salvar_conversas(conversas)
    return conv


def processar_mensagem_recebida(telefone, nome, texto):
    """Ponto de entrada chamado pelo WhatsAppManager (via callback) quando o
    receiver detecta uma mensagem nova. Nunca descarta a mensagem: cria um lead
    mínimo ("Contato desconhecido") quando o telefone não corresponde a nenhum
    lead existente (seção 25 do plano)."""
    if not texto:
        return None

    telefone_normalizado = normalizar_telefone(telefone) if telefone else ""
    lead = lead_service.obter_lead_por_telefone(telefone_normalizado) if telefone_normalizado else None

    if not lead:
        empresa = nome or (f"Contato {telefone}" if telefone else "Contato desconhecido")
        lead = lead_service.criar_lead_minimo(empresa, telefone or "", telefone_normalizado, origem="WhatsApp")

    registrar_mensagem(lead["id"], telefone_normalizado, texto, direcao="recebida", status="recebida")
    lead_service.adicionar_historico(lead["id"], "Mensagem recebida via WhatsApp")

    # Análise automática da IA a cada mensagem recebida (seção 25 do plano).
    # Import tardio: ai_conversation_service importa conversation_service no
    # nível do módulo, então um import no topo aqui criaria um ciclo.
    from services import ai_conversation_service
    ai_conversation_service.analisar_conversa(lead["id"])

    return lead
