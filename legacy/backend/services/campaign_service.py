import json
import os
import uuid
from datetime import datetime

BASE_DIR       = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
DATA_DIR       = os.path.join(BASE_DIR, "data")
CAMPAIGNS_FILE = os.path.join(DATA_DIR, "campaigns.json")

os.makedirs(DATA_DIR, exist_ok=True)

STATUS_RASCUNHO   = "Rascunho"
STATUS_AGENDADA   = "Agendada"
STATUS_EXECUCAO   = "Em execução"
STATUS_PAUSADA    = "Pausada"
STATUS_FINALIZADA = "Finalizada"
STATUS_CANCELADA  = "Cancelada"


def _agora():
    return datetime.now().isoformat(timespec="seconds")


def ler_campanhas():
    if not os.path.exists(CAMPAIGNS_FILE):
        return []
    with open(CAMPAIGNS_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def salvar_campanhas(campanhas):
    with open(CAMPAIGNS_FILE, "w", encoding="utf-8") as f:
        json.dump(campanhas, f, ensure_ascii=False, indent=2)


def obter_campanha(campanha_id):
    return next((c for c in ler_campanhas() if c["id"] == campanha_id), None)


def _novo_item_fila(lead_id):
    return {
        "lead_id":            lead_id,
        "status":             "pendente",
        "tentativas":         0,
        "ultima_tentativa":   None,
        "proximo_envio":      None,
        "erro":               None,
        "followups_enviados": 0,
    }


def _config_padrao(dados_config, total_leads):
    dados_config = dados_config or {}
    return {
        "intervalo_min_seg": int(dados_config.get("intervalo_min_seg", 20)),
        "intervalo_max_seg": int(dados_config.get("intervalo_max_seg", 60)),
        "limite_diario":     int(dados_config.get("limite_diario", 80)),
        "limite_campanha":   int(dados_config.get("limite_campanha", total_leads)),
        "modo_conservador":  bool(dados_config.get("modo_conservador", False)),
        "modo_teste":        bool(dados_config.get("modo_teste", False)),
    }


def criar_campanha(dados):
    campanhas = ler_campanhas()
    leads_ids = dados.get("leads", [])

    campanha = {
        "id":            str(uuid.uuid4()),
        "nome":          dados.get("nome", "").strip(),
        "descricao":     dados.get("descricao", "").strip(),
        "nicho":         dados.get("nicho", "").strip(),
        "cidade":        dados.get("cidade", "").strip(),
        "tags":          dados.get("tags", []),
        "leads":         leads_ids,
        "template":      dados.get("template", {}),
        "followups":     dados.get("followups", []),
        "configuracoes": _config_padrao(dados.get("configuracoes"), len(leads_ids)),
        "status":        STATUS_RASCUNHO,
        "metricas": {
            "enviadas": 0, "respostas": 0, "interessados": 0,
            "reunioes": 0, "propostas": 0, "clientes": 0,
        },
        "fila":       [_novo_item_fila(lid) for lid in leads_ids],
        "created_at": _agora(),
        "updated_at": _agora(),
    }
    campanhas.append(campanha)
    salvar_campanhas(campanhas)
    return campanha


def atualizar_campanha(campanha_id, dados):
    campanhas = ler_campanhas()
    idx = next((i for i, c in enumerate(campanhas) if c["id"] == campanha_id), None)
    if idx is None:
        return None
    campanha = campanhas[idx]

    for campo in ["nome", "descricao", "nicho", "cidade", "tags", "template", "followups"]:
        if campo in dados:
            campanha[campo] = dados[campo]

    if "configuracoes" in dados:
        campanha["configuracoes"].update(dados["configuracoes"])

    # A fila só pode ser reconstruída enquanto a campanha ainda não começou a rodar.
    if "leads" in dados and campanha["status"] == STATUS_RASCUNHO:
        campanha["leads"] = dados["leads"]
        campanha["fila"]  = [_novo_item_fila(lid) for lid in dados["leads"]]

    campanha["updated_at"] = _agora()
    campanhas[idx] = campanha
    salvar_campanhas(campanhas)
    return campanha


def _transicionar(campanha_id, status_permitidos, novo_status):
    campanhas = ler_campanhas()
    campanha = next((c for c in campanhas if c["id"] == campanha_id), None)
    if not campanha:
        return None, "Campanha não encontrada"
    if campanha["status"] not in status_permitidos:
        return None, f"Campanha não pode ir de '{campanha['status']}' para '{novo_status}'"
    campanha["status"]     = novo_status
    campanha["updated_at"] = _agora()
    salvar_campanhas(campanhas)
    return campanha, None


def _existe_campanha_em_execucao(excluir_id=None):
    return any(
        c["status"] == STATUS_EXECUCAO and c["id"] != excluir_id
        for c in ler_campanhas()
    )


def iniciar_campanha(campanha_id):
    if _existe_campanha_em_execucao(excluir_id=campanha_id):
        return None, "Já existe uma campanha em execução. Pause-a antes de iniciar outra."
    return _transicionar(campanha_id, {STATUS_RASCUNHO, STATUS_PAUSADA, STATUS_AGENDADA}, STATUS_EXECUCAO)


def pausar_campanha(campanha_id):
    return _transicionar(campanha_id, {STATUS_EXECUCAO}, STATUS_PAUSADA)


def retomar_campanha(campanha_id):
    if _existe_campanha_em_execucao(excluir_id=campanha_id):
        return None, "Já existe uma campanha em execução. Pause-a antes de retomar esta."
    return _transicionar(campanha_id, {STATUS_PAUSADA}, STATUS_EXECUCAO)


def parar_campanha(campanha_id):
    return _transicionar(campanha_id, {STATUS_EXECUCAO, STATUS_PAUSADA, STATUS_AGENDADA}, STATUS_CANCELADA)


def pular_item_fila(campanha_id, lead_id):
    campanhas = ler_campanhas()
    campanha = next((c for c in campanhas if c["id"] == campanha_id), None)
    if not campanha:
        return None, "Campanha não encontrada"
    item = next((i for i in campanha["fila"] if i["lead_id"] == lead_id), None)
    if not item:
        return None, "Lead não encontrado na fila desta campanha"
    item["status"]           = "pulado"
    item["ultima_tentativa"] = _agora()
    campanha["updated_at"]   = _agora()
    salvar_campanhas(campanhas)
    return campanha, None


def deletar_campanha(campanha_id):
    campanhas = ler_campanhas()
    antes = len(campanhas)
    campanhas = [c for c in campanhas if c["id"] != campanha_id]
    if len(campanhas) == antes:
        return False
    salvar_campanhas(campanhas)
    return True
