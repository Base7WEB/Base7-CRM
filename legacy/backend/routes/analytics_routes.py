from flask import Blueprint, jsonify

from services import analytics_service

analytics_bp = Blueprint("analytics", __name__, url_prefix="/api/analytics")


@analytics_bp.route("/geral", methods=["GET"])
def geral():
    return jsonify(analytics_service.metricas_gerais())


@analytics_bp.route("/por-template", methods=["GET"])
def por_template():
    return jsonify(analytics_service.metricas_por_template())


@analytics_bp.route("/por-nicho", methods=["GET"])
def por_nicho():
    return jsonify(analytics_service.metricas_por_nicho())
