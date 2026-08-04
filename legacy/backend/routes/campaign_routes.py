from flask import Blueprint, jsonify, request

from services import campaign_service, campaign_worker

campaigns_bp = Blueprint("campaigns", __name__, url_prefix="/api/campaigns")


@campaigns_bp.route("", methods=["GET"])
def listar():
    return jsonify(campaign_service.ler_campanhas())


@campaigns_bp.route("", methods=["POST"])
def criar():
    dados = request.get_json() or {}
    if not dados.get("nome", "").strip():
        return jsonify({"erro": "Nome da campanha é obrigatório"}), 400
    if not dados.get("leads"):
        return jsonify({"erro": "Selecione ao menos um lead"}), 400
    return jsonify(campaign_service.criar_campanha(dados)), 201


@campaigns_bp.route("/<campanha_id>", methods=["GET"])
def obter(campanha_id):
    campanha = campaign_service.obter_campanha(campanha_id)
    if not campanha:
        return jsonify({"erro": "Campanha não encontrada"}), 404
    return jsonify(campanha)


@campaigns_bp.route("/<campanha_id>", methods=["PUT"])
def atualizar(campanha_id):
    dados = request.get_json() or {}
    campanha = campaign_service.atualizar_campanha(campanha_id, dados)
    if not campanha:
        return jsonify({"erro": "Campanha não encontrada"}), 404
    return jsonify(campanha)


@campaigns_bp.route("/<campanha_id>", methods=["DELETE"])
def deletar(campanha_id):
    if not campaign_service.deletar_campanha(campanha_id):
        return jsonify({"erro": "Campanha não encontrada"}), 404
    return jsonify({"ok": True})


@campaigns_bp.route("/<campanha_id>/queue", methods=["GET"])
def queue(campanha_id):
    campanha = campaign_service.obter_campanha(campanha_id)
    if not campanha:
        return jsonify({"erro": "Campanha não encontrada"}), 404
    return jsonify(campanha.get("fila", []))


@campaigns_bp.route("/<campanha_id>/queue/<lead_id>/skip", methods=["POST"])
def skip(campanha_id, lead_id):
    campanha, erro = campaign_service.pular_item_fila(campanha_id, lead_id)
    if erro:
        return jsonify({"erro": erro}), 404
    return jsonify(campanha)


@campaigns_bp.route("/<campanha_id>/start", methods=["POST"])
def start(campanha_id):
    if not campaign_service.obter_campanha(campanha_id):
        return jsonify({"erro": "Campanha não encontrada"}), 404
    campanha, erro = campaign_service.iniciar_campanha(campanha_id)
    if erro:
        return jsonify({"erro": erro}), 409
    campaign_worker.garantir_worker_rodando()
    return jsonify(campanha)


@campaigns_bp.route("/<campanha_id>/pause", methods=["POST"])
def pause(campanha_id):
    if not campaign_service.obter_campanha(campanha_id):
        return jsonify({"erro": "Campanha não encontrada"}), 404
    campanha, erro = campaign_service.pausar_campanha(campanha_id)
    if erro:
        return jsonify({"erro": erro}), 409
    return jsonify(campanha)


@campaigns_bp.route("/<campanha_id>/resume", methods=["POST"])
def resume(campanha_id):
    if not campaign_service.obter_campanha(campanha_id):
        return jsonify({"erro": "Campanha não encontrada"}), 404
    campanha, erro = campaign_service.retomar_campanha(campanha_id)
    if erro:
        return jsonify({"erro": erro}), 409
    campaign_worker.garantir_worker_rodando()
    return jsonify(campanha)


@campaigns_bp.route("/<campanha_id>/stop", methods=["POST"])
def stop(campanha_id):
    if not campaign_service.obter_campanha(campanha_id):
        return jsonify({"erro": "Campanha não encontrada"}), 404
    campanha, erro = campaign_service.parar_campanha(campanha_id)
    if erro:
        return jsonify({"erro": erro}), 409
    return jsonify(campanha)
