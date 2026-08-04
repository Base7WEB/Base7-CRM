from flask import Blueprint, jsonify, request

from services import analytics_service
from services.whatsapp_service import whatsapp_service

whatsapp_bp = Blueprint("whatsapp", __name__, url_prefix="/api/whatsapp")


@whatsapp_bp.route("/status", methods=["GET"])
def status():
    return jsonify(whatsapp_service.status())


@whatsapp_bp.route("/qr", methods=["GET"])
def qr():
    return jsonify(whatsapp_service.qr())


@whatsapp_bp.route("/connect", methods=["POST"])
def connect():
    return jsonify(whatsapp_service.connect())


@whatsapp_bp.route("/disconnect", methods=["POST"])
def disconnect():
    return jsonify(whatsapp_service.disconnect())


@whatsapp_bp.route("/send", methods=["POST"])
def send():
    data    = request.get_json() or {}
    lead_id = data.get("lead_id", "")
    texto   = data.get("texto", "").strip()

    if not lead_id or not texto:
        return jsonify({"ok": False, "erro": "lead_id e texto são obrigatórios"}), 400

    resultado, http_status = whatsapp_service.send_to_lead(lead_id, texto, campanha_id=data.get("campanha_id"))
    return jsonify(resultado), http_status


@whatsapp_bp.route("/check-number", methods=["POST"])
def check_number():
    data     = request.get_json() or {}
    telefone = data.get("telefone", "")
    if not telefone:
        return jsonify({"existe": False, "erro": "telefone é obrigatório"}), 400
    return jsonify(whatsapp_service.check_number(telefone))


@whatsapp_bp.route("/dashboard", methods=["GET"])
def dashboard():
    return jsonify(analytics_service.dashboard_whatsapp())
