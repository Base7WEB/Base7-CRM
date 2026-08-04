from flask import Blueprint, jsonify, request

from services import ai_conversation_service, conversation_service, lead_service
from services.whatsapp_service import whatsapp_service

conversations_bp = Blueprint("conversations", __name__, url_prefix="/api/conversations")


@conversations_bp.route("", methods=["GET"])
def listar():
    conversas = conversation_service.ler_conversas()
    resultado = []

    for conv in conversas:
        lead = lead_service.obter_lead(conv["lead_id"])
        mensagens = conv.get("mensagens", [])
        ultima = mensagens[-1] if mensagens else None
        resultado.append({
            "lead_id":         conv["lead_id"],
            "telefone":        conv.get("telefone"),
            "empresa":         lead["empresa"] if lead else "Contato desconhecido",
            "nicho":           lead.get("nicho", "") if lead else "",
            "score":           lead.get("score", 0) if lead else 0,
            "status":          lead.get("status") if lead else None,
            "temperatura":     lead.get("temperatura") if lead else None,
            "ultima_mensagem": ultima,
            "total_mensagens": len(mensagens),
        })

    resultado.sort(key=lambda c: (c["ultima_mensagem"] or {}).get("data", ""), reverse=True)
    return jsonify(resultado)


@conversations_bp.route("/<lead_id>", methods=["GET"])
def obter(lead_id):
    lead = lead_service.obter_lead(lead_id)
    if not lead:
        return jsonify({"erro": "Lead não encontrado"}), 404

    conv = conversation_service.obter_conversa_por_lead(lead_id) or {
        "lead_id": lead_id,
        "telefone": lead.get("telefone_normalizado", ""),
        "mensagens": [],
        "ultima_analise_ia": None,
    }
    return jsonify({"lead": lead, "conversa": conv})


@conversations_bp.route("/<lead_id>/send", methods=["POST"])
def enviar(lead_id):
    data  = request.get_json() or {}
    texto = data.get("texto", "").strip()
    if not texto:
        return jsonify({"erro": "Texto é obrigatório"}), 400

    resultado, http_status = whatsapp_service.send_to_lead(lead_id, texto)
    return jsonify(resultado), http_status


@conversations_bp.route("/<lead_id>/analyze", methods=["POST"])
def analisar(lead_id):
    dados, erro, http_status = ai_conversation_service.analisar_conversa(lead_id)
    if erro:
        return jsonify({"erro": erro}), http_status
    return jsonify(dados)


@conversations_bp.route("/<lead_id>/generate-response", methods=["POST"])
def gerar_resposta(lead_id):
    resposta, erro, http_status = ai_conversation_service.gerar_resposta(lead_id)
    if erro:
        return jsonify({"erro": erro}), http_status
    return jsonify({"resposta": resposta})
