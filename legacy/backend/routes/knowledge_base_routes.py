from flask import Blueprint, jsonify, request

from services import knowledge_base_service

knowledge_base_bp = Blueprint("knowledge_base", __name__, url_prefix="/api/knowledge-base")


@knowledge_base_bp.route("", methods=["GET"])
def obter():
    return jsonify(knowledge_base_service.ler_base_conhecimento())


@knowledge_base_bp.route("", methods=["POST"])
def salvar():
    dados = request.get_json() or {}
    return jsonify(knowledge_base_service.salvar_base_conhecimento(dados))
