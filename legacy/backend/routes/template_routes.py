from flask import Blueprint, jsonify, request

from services import template_service

templates_bp = Blueprint("templates", __name__, url_prefix="/api/templates")


@templates_bp.route("", methods=["GET"])
def listar():
    return jsonify(template_service.ler_templates())


@templates_bp.route("", methods=["POST"])
def salvar():
    dados = request.get_json()
    if not isinstance(dados, dict):
        return jsonify({"erro": "Formato inválido. Esperado objeto {etapa: [templates]}."}), 400
    template_service.salvar_templates(dados)
    return jsonify({"ok": True})
