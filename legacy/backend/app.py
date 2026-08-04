import json
import os
import uuid
import re
from datetime import datetime, timedelta
from threading import Thread

from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS

try:
    from scraper import rodar_pesquisa, rodar_instagram
    _SCRAPER_OK = True
except Exception as e:
    print(f"[AVISO] Scraper indisponível: {e}")
    _SCRAPER_OK = False
    def rodar_pesquisa(*a, **kw): return []
    def rodar_instagram(*a, **kw): return []

try:
    import anthropic
    _CLAUDE_OK = True
except ImportError:
    _CLAUDE_OK = False

# whatsapp_bp, campaigns_bp (via campaign_worker) e conversations_bp dependem,
# em cadeia, de services.whatsapp_service -> whatsapp.manager -> Playwright.
# Guardados juntos: se o Playwright não estiver disponível, todo o módulo
# WhatsApp fica indisponível, mas o resto do CRM continua funcionando
# (mesmo padrão defensivo já usado para o scraper de prospecção).
try:
    from routes.whatsapp_routes import whatsapp_bp
    from routes.campaign_routes import campaigns_bp
    from routes.conversation_routes import conversations_bp
    _WHATSAPP_OK = True
except Exception as e:
    print(f"[AVISO] Módulo WhatsApp indisponível: {e}")
    _WHATSAPP_OK = False
    whatsapp_bp = campaigns_bp = conversations_bp = None

from services.lead_service import (
    ler_leads, salvar_leads, agora, calcular_score, sugerir_proxima_acao,
    importar_leads as lead_service_importar_leads,
)
from services.config_service import ler_config, salvar_config
from services import claude_client, ai_conversation_service
from routes.template_routes import templates_bp
from routes.import_routes import import_bp
from routes.knowledge_base_routes import knowledge_base_bp
from routes.notification_routes import notifications_bp
from routes.analytics_routes import analytics_bp

# ─── Config ───────────────────────────────────────────────────────────────────

BASE_DIR    = os.path.dirname(os.path.abspath(__file__))
DATA_DIR    = os.path.join(BASE_DIR, "data")
META_FILE   = os.path.join(DATA_DIR, "meta.json")
FRONT_DIR   = os.path.join(BASE_DIR, "..", "frontend")

os.makedirs(DATA_DIR, exist_ok=True)

app = Flask(__name__, static_folder=FRONT_DIR, static_url_path="")
CORS(app)

if _WHATSAPP_OK:
    app.register_blueprint(whatsapp_bp)
    app.register_blueprint(campaigns_bp)
    app.register_blueprint(conversations_bp)
app.register_blueprint(templates_bp)
app.register_blueprint(import_bp)
app.register_blueprint(knowledge_base_bp)
app.register_blueprint(notifications_bp)
app.register_blueprint(analytics_bp)

# ─── Helpers ──────────────────────────────────────────────────────────────────
# ler_leads/salvar_leads/agora/calcular_score/sugerir_proxima_acao vivem em
# services/lead_service.py para poderem ser reutilizados pelos novos serviços
# de WhatsApp/campanhas/conversas sem import circular com este módulo.

def ler_meta():
    if not os.path.exists(META_FILE):
        return {"valor": 0, "mes": datetime.now().strftime("%Y-%m")}
    with open(META_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except Exception:
            return {"valor": 0, "mes": datetime.now().strftime("%Y-%m")}


def salvar_meta(meta):
    with open(META_FILE, "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False)


# ler_config/salvar_config vivem em services/config_service.py (mesmo motivo do
# lead_service: reuso pelos novos serviços de IA/WhatsApp sem import circular).

# ─── Servir frontend ──────────────────────────────────────────────────────────

@app.route("/")
def index():
    return send_from_directory(FRONT_DIR, "index.html")


# ─── Status ───────────────────────────────────────────────────────────────────

@app.route("/api/status")
def status():
    return jsonify({"ok": True, "versao": "2.0.0", "claude_ok": _CLAUDE_OK, "whatsapp_ok": _WHATSAPP_OK})


# ─── CRUD Leads ───────────────────────────────────────────────────────────────

@app.route("/api/leads", methods=["GET"])
def listar_leads():
    leads = ler_leads()
    for l in leads:
        l["score"]            = calcular_score(l)
        l["proxima_acao"]     = sugerir_proxima_acao(l)
        if not l.get("statusChangedAt"):
            l["statusChangedAt"] = l.get("criadoEm", agora())
    return jsonify(leads)


@app.route("/api/leads", methods=["POST"])
def criar_lead():
    data  = request.get_json()
    leads = ler_leads()

    lead = {
        "id":              str(uuid.uuid4()),
        "empresa":         data.get("empresa", "").strip(),
        "responsavel":     data.get("responsavel", "").strip(),
        "nicho":           data.get("nicho", "").strip(),
        "cidade":          data.get("cidade", "").strip(),
        "endereco":        data.get("endereco", "").strip(),
        "telefone":        data.get("telefone", "").strip(),
        "instagram":       data.get("instagram", "").strip(),
        "site":            data.get("site", "").strip(),
        "email":           data.get("email", "").strip(),
        "valor":           float(data.get("valor", 0) or 0),
        "origem":          data.get("origem", "Manual"),
        "status":          data.get("status", "Novo"),
        "rating_google":   float(data.get("rating_google", 0) or 0),
        "reviews_google":  int(data.get("reviews_google", 0) or 0),
        "followup":        data.get("followup", ""),
        "obs":             data.get("obs", "").strip(),
        "tags":            data.get("tags", []),
        "tasks":           data.get("tasks", []),
        "historico":       [{"data": agora(), "acao": "Lead criado"}],
        "criadoEm":        agora(),
        "atualizadoEm":    agora(),
        "statusChangedAt": agora(),
    }
    lead["score"] = calcular_score(lead)

    leads.append(lead)
    salvar_leads(leads)
    return jsonify(lead), 201


@app.route("/api/leads/<lead_id>", methods=["PUT"])
def atualizar_lead(lead_id):
    data  = request.get_json()
    leads = ler_leads()

    idx = next((i for i, l in enumerate(leads) if l["id"] == lead_id), None)
    if idx is None:
        return jsonify({"erro": "Lead não encontrado"}), 404

    lead               = leads[idx]
    historico_anterior = lead.get("historico", [])

    campos = ["empresa","responsavel","nicho","cidade","endereco",
              "telefone","instagram","site","email","followup","obs",
              "origem","rating_google","reviews_google"]
    for campo in campos:
        if campo in data:
            lead[campo] = data[campo]

    if "valor" in data:
        lead["valor"] = float(data["valor"] or 0)

    if "tags" in data:
        lead["tags"] = data["tags"]

    if "tasks" in data:
        lead["tasks"] = data["tasks"]

    if "status" in data and data["status"] != lead.get("status"):
        historico_anterior.append({"data": agora(), "acao": f"Movido para {data['status']}"})
        lead["status"]          = data["status"]
        lead["statusChangedAt"] = agora()

    if "historico_add" in data:
        historico_anterior.append({"data": agora(), "acao": data["historico_add"]})

    lead["historico"]    = historico_anterior
    lead["atualizadoEm"] = agora()
    lead["score"]        = calcular_score(lead)

    if not lead.get("statusChangedAt"):
        lead["statusChangedAt"] = lead.get("criadoEm", agora())

    leads[idx] = lead
    salvar_leads(leads)
    return jsonify(lead)


@app.route("/api/leads/<lead_id>", methods=["DELETE"])
def deletar_lead(lead_id):
    leads = ler_leads()
    antes = len(leads)
    leads = [l for l in leads if l["id"] != lead_id]
    if len(leads) == antes:
        return jsonify({"erro": "Lead não encontrado"}), 404
    salvar_leads(leads)
    return jsonify({"ok": True})


# ─── Meta Mensal ──────────────────────────────────────────────────────────────

@app.route("/api/meta", methods=["GET"])
def get_meta():
    return jsonify(ler_meta())


@app.route("/api/meta", methods=["POST"])
def set_meta():
    data = request.get_json()
    meta = {
        "valor": float(data.get("valor", 0)),
        "mes":   data.get("mes", datetime.now().strftime("%Y-%m")),
    }
    salvar_meta(meta)
    return jsonify(meta)


# ─── Config do Sistema ────────────────────────────────────────────────────────

@app.route("/api/config", methods=["GET"])
def get_config():
    cfg  = ler_config()
    safe = {k: v for k, v in cfg.items() if k != "claude_api_key"}
    if "claude_api_key" in cfg:
        key = cfg["claude_api_key"]
        safe["claude_api_key_set"]  = True
        safe["claude_api_key_hint"] = f"sk-...{key[-4:]}" if len(key) > 8 else "****"
    else:
        safe["claude_api_key_set"] = False
    safe["claude_disponivel"] = _CLAUDE_OK
    return jsonify(safe)


@app.route("/api/config", methods=["POST"])
def set_config():
    data = request.get_json()
    cfg  = ler_config()
    for k in ["claude_api_key", "agendado_ativo", "agendado_nicho",
              "agendado_cidades", "agendado_max", "agendado_dia_semana",
              "agendado_ultimo_run",
              "ia_automacao_nivel", "ia_auto_perguntas_simples", "ia_auto_preco",
              "ia_auto_contratar", "ia_auto_reuniao", "ia_auto_negociacao",
              "ia_auto_reclamacao"]:
        if k in data:
            cfg[k] = data[k]
    salvar_config(cfg)
    return jsonify({"ok": True})


# ─── IA — Análise de Lead ─────────────────────────────────────────────────────

@app.route("/api/ia/analisar", methods=["POST"])
def ia_analisar():
    lead = request.get_json().get("lead", {})

    hist_txt = "\n".join(
        f"  - {h['data']}: {h['acao']}" for h in lead.get("historico", [])
    ) or "  Nenhum histórico"

    prompt = f"""Você é um especialista em vendas B2B. Analise este lead e responda APENAS com JSON válido:

Lead:
- Empresa: {lead.get('empresa','?')}
- Nicho: {lead.get('nicho','?')} | Cidade: {lead.get('cidade','?')}
- Status: {lead.get('status','?')} | Valor: R$ {lead.get('valor',0):,.0f}
- Site: {'Sim' if lead.get('site') else 'Não'} | WhatsApp: {'Sim' if lead.get('telefone') else 'Não'} | Instagram: {'Sim' if lead.get('instagram') else 'Não'}
- Google: {lead.get('rating_google',0)}★ ({lead.get('reviews_google',0)} reviews)
- Follow-up: {lead.get('followup') or 'Não agendado'}
- Obs: {lead.get('obs') or 'Nenhuma'}
- Histórico:
{hist_txt}

Responda APENAS com este JSON (sem texto fora do JSON):
{{"score":75,"justificativa":"motivo em 1-2 frases","proxima_acao":"ação específica e direta","insight":"observação estratégica sobre este lead"}}"""

    dados, erro, http_status = claude_client.perguntar_json(prompt)
    if erro:
        return jsonify({"erro": erro}), http_status
    return jsonify(dados)


@app.route("/api/ia/analisar-mensagem", methods=["POST"])
def ia_analisar_mensagem():
    """Atalho equivalente a POST /api/conversations/<lead_id>/analyze (seção 54 do plano)."""
    data    = request.get_json() or {}
    lead_id = data.get("lead_id", "")
    if not lead_id:
        return jsonify({"erro": "lead_id é obrigatório"}), 400

    dados, erro, http_status = ai_conversation_service.analisar_conversa(lead_id)
    if erro:
        return jsonify({"erro": erro}), http_status
    return jsonify(dados)


@app.route("/api/ia/gerar-resposta", methods=["POST"])
def ia_gerar_resposta():
    """Atalho equivalente a POST /api/conversations/<lead_id>/generate-response."""
    data    = request.get_json() or {}
    lead_id = data.get("lead_id", "")
    if not lead_id:
        return jsonify({"erro": "lead_id é obrigatório"}), 400

    resposta, erro, http_status = ai_conversation_service.gerar_resposta(lead_id)
    if erro:
        return jsonify({"erro": erro}), http_status
    return jsonify({"resposta": resposta})


# ─── Relatório Semanal ────────────────────────────────────────────────────────

@app.route("/api/relatorio-semanal", methods=["GET"])
def relatorio_semanal():
    leads          = ler_leads()
    hoje           = datetime.now()
    semana_atras   = hoje - timedelta(days=7)
    sa_str         = semana_atras.isoformat(timespec="seconds")
    hoje_str       = hoje.strftime("%Y-%m-%d")
    em7_str        = (hoje + timedelta(days=7)).strftime("%Y-%m-%d")

    novos          = [l for l in leads if l.get("criadoEm","") >= sa_str]
    fechados       = [l for l in leads if l.get("status") == "Cliente" and l.get("atualizadoEm","") >= sa_str]
    valor_fechado  = sum(l.get("valor", 0) for l in fechados)
    fu_proximos    = [l for l in leads if l.get("followup","") >= hoje_str and l.get("followup","") <= em7_str]

    por_status = {
        s: len([l for l in leads if l.get("status") == s])
        for s in ["Novo","Contato","Reunião","Proposta","Negociação","Cliente","Perdido"]
    }

    return jsonify({
        "periodo":         {"inicio": semana_atras.strftime("%d/%m/%Y"), "fim": hoje.strftime("%d/%m/%Y")},
        "novos_semana":    len(novos),
        "clientes_semana": len(fechados),
        "valor_fechado":   valor_fechado,
        "followups_prox":  len(fu_proximos),
        "total_leads":     len(leads),
        "por_status":      por_status,
        "leads_novos":     [{"empresa": l["empresa"], "nicho": l.get("nicho",""), "score": l.get("score",0)}
                            for l in novos[:10]],
    })


# ─── Prospecção ───────────────────────────────────────────────────────────────

_pesquisa_estado = {"rodando": False, "progresso": 0, "total": 0, "resultados": [], "erro": ""}


@app.route("/api/pesquisar", methods=["POST"])
def pesquisar():
    global _pesquisa_estado

    if _pesquisa_estado["rodando"]:
        return jsonify({"erro": "Já existe uma pesquisa em andamento"}), 409

    data    = request.get_json()
    nicho   = data.get("nicho", "").strip()
    cidade  = data.get("cidade", "").strip()
    cidades = data.get("cidades", [])

    raio_km        = int(data.get("raio_km", 10))
    rating_min     = float(data.get("rating_min", 0))
    max_resultados = int(data.get("max_resultados", 40))
    enriquecer     = bool(data.get("enriquecer", False))

    # Normaliza cidades: aceita lista OU campo cidade com vírgulas
    if not cidades and cidade:
        cidades = [c.strip() for c in cidade.split(",") if c.strip()]
    if not cidades:
        return jsonify({"erro": "Nicho e cidade são obrigatórios"}), 400
    if not nicho:
        return jsonify({"erro": "Nicho é obrigatório"}), 400

    total_est = max_resultados * len(cidades)
    _pesquisa_estado = {
        "rodando": True, "progresso": 0, "total": total_est,
        "resultados": [], "erro": "", "cidades_total": len(cidades),
    }

    def executar():
        global _pesquisa_estado
        todos   = []
        base    = 0
        try:
            for cid in cidades:
                def cb(atual, total, _base=base):
                    _pesquisa_estado["progresso"] = _base + atual

                res = rodar_pesquisa(nicho, cid, raio_km, rating_min, max_resultados, cb, enriquecer)
                todos.extend(res)
                base += max_resultados
            _pesquisa_estado["resultados"] = todos
        except Exception as e:
            _pesquisa_estado["erro"] = str(e)
        finally:
            _pesquisa_estado["rodando"] = False

    Thread(target=executar, daemon=True).start()
    return jsonify({"ok": True, "mensagem": f"Pesquisa iniciada para {len(cidades)} cidade(s)"})


@app.route("/api/pesquisar/status", methods=["GET"])
def status_pesquisa():
    return jsonify(_pesquisa_estado)


@app.route("/api/pesquisar-instagram", methods=["POST"])
def pesquisar_instagram():
    global _pesquisa_estado

    if _pesquisa_estado["rodando"]:
        return jsonify({"erro": "Já existe uma pesquisa em andamento"}), 409

    data          = request.get_json()
    hashtag       = data.get("hashtag", "").strip().lstrip("#")
    max_resultados = int(data.get("max_resultados", 20))

    if not hashtag:
        return jsonify({"erro": "Hashtag é obrigatória"}), 400

    _pesquisa_estado = {
        "rodando": True, "progresso": 0, "total": max_resultados,
        "resultados": [], "erro": "",
    }

    def executar():
        global _pesquisa_estado
        try:
            def cb(atual, total):
                _pesquisa_estado["progresso"] = atual
                _pesquisa_estado["total"]     = total
            resultados = rodar_instagram(hashtag, max_resultados, cb)
            _pesquisa_estado["resultados"] = resultados
        except Exception as e:
            _pesquisa_estado["erro"] = str(e)
        finally:
            _pesquisa_estado["rodando"] = False

    Thread(target=executar, daemon=True).start()
    return jsonify({"ok": True})


# ─── Importar Leads ───────────────────────────────────────────────────────────

@app.route("/api/importar", methods=["POST"])
def importar_leads():
    data  = request.get_json()
    novos = data.get("leads", [])
    importados, duplicados = lead_service_importar_leads(novos)
    return jsonify({"importados": len(importados), "duplicados": duplicados})


# ─── Backup / Restore ─────────────────────────────────────────────────────────

@app.route("/api/backup", methods=["GET"])
def backup():
    return jsonify(ler_leads())


@app.route("/api/restore", methods=["POST"])
def restore():
    data = request.get_json()
    if not isinstance(data, list):
        return jsonify({"erro": "Formato inválido. Esperado array de leads."}), 400
    salvar_leads(data)
    return jsonify({"ok": True, "total": len(data)})


# ─── Agendamento de Prospecção ────────────────────────────────────────────────

def _verificar_agendamento():
    """Executado na inicialização: verifica se há scraping agendado para hoje."""
    global _pesquisa_estado
    import time
    time.sleep(5)  # espera backend iniciar
    while True:
        try:
            cfg = ler_config()
            if not cfg.get("agendado_ativo"):
                time.sleep(3600)
                continue

            hoje       = datetime.now()
            dia_semana = hoje.weekday()  # 0=seg, 6=dom
            cfg_dia    = int(cfg.get("agendado_dia_semana", 1))  # padrão: terça
            ultimo_run = cfg.get("agendado_ultimo_run", "")
            hoje_str   = hoje.strftime("%Y-%m-%d")

            if dia_semana == cfg_dia and ultimo_run != hoje_str:
                nicho   = cfg.get("agendado_nicho", "")
                cidades = [c.strip() for c in cfg.get("agendado_cidades", "").split(",") if c.strip()]
                max_r   = int(cfg.get("agendado_max", 30))

                if nicho and cidades and not _pesquisa_estado.get("rodando"):
                    print(f"[Agendado] Iniciando scraping automático: {nicho} em {cidades}")
                    _pesquisa_estado = {
                        "rodando": True, "progresso": 0, "total": max_r * len(cidades),
                        "resultados": [], "erro": "", "agendado": True,
                    }
                    todos = []
                    base  = 0
                    for cid in cidades:
                        def cb(a, t, _b=base):
                            _pesquisa_estado["progresso"] = _b + a
                        res = rodar_pesquisa(nicho, cid, 10, 0, max_r, cb, False)
                        todos.extend(res)
                        base += max_r
                    _pesquisa_estado["resultados"] = todos
                    _pesquisa_estado["rodando"]    = False

                    cfg["agendado_ultimo_run"] = hoje_str
                    salvar_config(cfg)
                    print(f"[Agendado] Finalizado: {len(todos)} leads coletados")

        except Exception as e:
            print(f"[Agendado] Erro: {e}")

        time.sleep(3600)


Thread(target=_verificar_agendamento, daemon=True).start()


# ─── Main ─────────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    print("=" * 50)
    print("  BASE7 CRM — Backend v2.0")
    print("  Acesse: http://localhost:5000")
    print("=" * 50)
    app.run(host="0.0.0.0", port=5000, debug=False)
