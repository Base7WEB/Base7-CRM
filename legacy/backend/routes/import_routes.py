from flask import Blueprint, jsonify, request
from werkzeug.utils import secure_filename

from services import import_service

import_bp = Blueprint("import_files", __name__, url_prefix="/api/importar")


@import_bp.route("/preview", methods=["POST"])
def preview():
    arquivo = request.files.get("arquivo")
    if not arquivo or not arquivo.filename:
        return jsonify({"erro": "Nenhum arquivo enviado"}), 400

    nome = secure_filename(arquivo.filename)
    valido, _ext = import_service.extensao_valida(nome)
    if not valido:
        return jsonify({"erro": "Formato não suportado. Use CSV, XLSX ou TXT."}), 400

    conteudo = arquivo.read()
    if len(conteudo) > import_service.TAMANHO_MAXIMO_BYTES:
        return jsonify({"erro": "Arquivo muito grande (máximo 5 MB)"}), 400

    try:
        resultado = import_service.processar_arquivo(nome, conteudo)
    except Exception as e:
        return jsonify({"erro": f"Falha ao ler o arquivo: {e}"}), 400

    return jsonify(resultado)
