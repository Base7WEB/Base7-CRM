from flask import Blueprint, jsonify

from services import notification_service

notifications_bp = Blueprint("notifications", __name__, url_prefix="/api/notifications")


@notifications_bp.route("", methods=["GET"])
def listar():
    notificacoes = notification_service.ler_notificacoes()
    notificacoes.sort(key=lambda n: n.get("criada_em", ""), reverse=True)
    return jsonify(notificacoes)


@notifications_bp.route("/<notif_id>/read", methods=["POST"])
def marcar_lida(notif_id):
    notificacao = notification_service.marcar_lida(notif_id)
    if not notificacao:
        return jsonify({"erro": "Notificação não encontrada"}), 404
    return jsonify(notificacao)


@notifications_bp.route("/read-all", methods=["POST"])
def marcar_todas_lidas():
    notification_service.marcar_todas_lidas()
    return jsonify({"ok": True})
