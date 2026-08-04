import random
import threading
import time
from datetime import datetime

from services import campaign_service, conversation_service, lead_service, notification_service
from services.whatsapp_service import whatsapp_service

_TICK_SEGUNDOS = 3

# Leads que já saíram de "Novo" presume-se que tiveram atenção humana ou
# mudaram de estágio — não recebem mais follow-up automático de prospecção.
ESTADOS_SEM_FOLLOWUP_AUTOMATICO = {"Contato", "Reunião", "Proposta", "Negociação", "Cliente", "Perdido"}

_worker_thread = None
_worker_lock   = threading.Lock()


def garantir_worker_rodando():
    """Inicia a thread do worker sob demanda (na primeira campanha iniciada)."""
    global _worker_thread
    with _worker_lock:
        if _worker_thread and _worker_thread.is_alive():
            return
        _worker_thread = threading.Thread(target=_loop, daemon=True)
        _worker_thread.start()


def _loop():
    while True:
        try:
            _processar_tick()
        except Exception as e:
            print(f"[CampaignWorker] Erro: {e}")
            time.sleep(_TICK_SEGUNDOS)


def _campanha_ativa():
    return next(
        (c for c in campaign_service.ler_campanhas() if c["status"] == campaign_service.STATUS_EXECUCAO),
        None,
    )


def _processar_tick():
    """No máximo uma ação (envio inicial OU follow-up) por tick, em toda a sessão —
    garante fila única e nunca dois envios simultâneos (seção 48 do plano)."""
    cfg = _tentar_processar_fila_principal()
    if not cfg:
        cfg = _tentar_processar_followup()

    if cfg:
        intervalo_min = cfg.get("intervalo_min_seg", 20)
        intervalo_max = cfg.get("intervalo_max_seg", 60)
        if cfg.get("modo_conservador"):
            intervalo_min *= 2
            intervalo_max *= 2
        time.sleep(random.uniform(intervalo_min, intervalo_max))
    else:
        time.sleep(_TICK_SEGUNDOS)


def _tentar_processar_fila_principal():
    """Processa o próximo envio pendente da campanha ativa. Retorna as
    configurações da campanha se enviou algo, ou None se não havia o que fazer."""
    campanha = _campanha_ativa()
    if not campanha:
        return None

    fila = campanha.get("fila", [])
    pendentes = [item for item in fila if item["status"] == "pendente"]

    if not pendentes:
        _finalizar_campanha(campanha["id"])
        return None

    cfg = campanha["configuracoes"]

    enviados_total = sum(1 for item in fila if item["status"] == "enviado")
    if enviados_total >= cfg.get("limite_campanha", len(fila)):
        _finalizar_campanha(campanha["id"])
        return None

    hoje = datetime.now().strftime("%Y-%m-%d")
    enviados_hoje = sum(
        1 for item in fila
        if item["status"] == "enviado" and (item.get("ultima_tentativa") or "")[:10] == hoje
    )
    if enviados_hoje >= cfg.get("limite_diario", 80):
        return None  # limite diário atingido; aguarda o próximo dia sem consumir a fila

    if not cfg.get("modo_teste") and not whatsapp_service.status().get("conectado"):
        _pausar_por_desconexao(campanha["id"])
        return None

    _enviar_item(campanha, pendentes[0])
    return cfg


def _tentar_processar_followup():
    """Varre todas as campanhas com envios em andamento/concluídos em busca de um
    follow-up pronto para disparar. Retorna as configurações da campanha usada,
    ou None se nada estava pronto."""
    campanhas_relevantes = (
        campaign_service.STATUS_EXECUCAO, campaign_service.STATUS_FINALIZADA,
    )
    for campanha in campaign_service.ler_campanhas():
        if campanha["status"] not in campanhas_relevantes:
            continue
        followups = campanha.get("followups", [])
        if not followups:
            continue
        for item in campanha.get("fila", []):
            if item["status"] != "enviado":
                continue
            followup = _followup_pendente(item, followups)
            if followup and _enviar_followup(campanha, item, followup):
                return campanha["configuracoes"]
    return None


def _followup_pendente(item, followups):
    idx = item.get("followups_enviados", 0)
    if idx >= len(followups):
        return None

    ultima = item.get("ultima_tentativa")
    if not ultima:
        return None

    lead = lead_service.obter_lead(item["lead_id"])
    if not lead or lead.get("status", "Novo") in ESTADOS_SEM_FOLLOWUP_AUTOMATICO:
        return None

    if _lead_respondeu(item["lead_id"], ultima):
        return None

    try:
        dias_passados = (datetime.now() - datetime.fromisoformat(ultima)).days
    except ValueError:
        return None

    followup = followups[idx]
    if dias_passados < followup.get("dias", 3):
        return None
    return followup


def _lead_respondeu(lead_id, desde_iso):
    conversa = conversation_service.obter_conversa_por_lead(lead_id)
    if not conversa:
        return False
    return any(
        m.get("direcao") == "recebida" and m.get("data", "") > desde_iso
        for m in conversa.get("mensagens", [])
    )


def _enviar_followup(campanha, item, followup):
    lead = lead_service.obter_lead(item["lead_id"])
    if not lead:
        return False

    cfg = campanha["configuracoes"]
    if not cfg.get("modo_teste") and not whatsapp_service.status().get("conectado"):
        return False  # tenta de novo no próximo tick, sem consumir o follow-up

    agora = lead_service.agora()
    texto = _renderizar_mensagem(followup.get("texto", ""), lead)

    if cfg.get("modo_teste"):
        _atualizar_item(campanha["id"], item["lead_id"], ultima_tentativa=agora,
                         followups_enviados=item.get("followups_enviados", 0) + 1)
        return True

    resultado, _http = whatsapp_service.send_to_lead(item["lead_id"], texto, campanha_id=campanha["id"])
    if resultado.get("ok"):
        _atualizar_item(campanha["id"], item["lead_id"], ultima_tentativa=agora,
                         followups_enviados=item.get("followups_enviados", 0) + 1)
        return True
    return False


def _enviar_item(campanha, item):
    agora = lead_service.agora()
    lead  = lead_service.obter_lead(item["lead_id"])

    if not lead:
        _atualizar_item(campanha["id"], item["lead_id"], status="erro",
                         erro="Lead não encontrado", ultima_tentativa=agora)
        return

    texto = _renderizar_mensagem(campanha.get("template", {}).get("texto", ""), lead)
    cfg   = campanha["configuracoes"]

    if cfg.get("modo_teste"):
        _atualizar_item(campanha["id"], item["lead_id"], status="enviado", erro=None,
                         ultima_tentativa=agora, simulado=True)
        _incrementar_metrica(campanha["id"], "enviadas")
        return

    resultado, _http = whatsapp_service.send_to_lead(item["lead_id"], texto, campanha_id=campanha["id"])

    if resultado.get("ok"):
        _atualizar_item(campanha["id"], item["lead_id"], status="enviado", erro=None, ultima_tentativa=agora)
        _incrementar_metrica(campanha["id"], "enviadas")
    else:
        tentativas  = item.get("tentativas", 0) + 1
        novo_status = "erro" if tentativas >= 3 else "pendente"
        _atualizar_item(campanha["id"], item["lead_id"], status=novo_status, erro=resultado.get("erro"),
                         ultima_tentativa=agora, tentativas=tentativas)


def _renderizar_mensagem(texto, lead):
    return (texto or "") \
        .replace("{empresa}", lead.get("empresa", "")) \
        .replace("{responsavel}", lead.get("responsavel", "")) \
        .replace("{cidade}", lead.get("cidade", "")) \
        .replace("{nicho}", lead.get("nicho", "")) \
        .replace("{rating}", str(lead.get("rating_google", "") or "")) \
        .replace("{site}", lead.get("site", "")) \
        .replace("{instagram}", lead.get("instagram", ""))


def _atualizar_item(campanha_id, lead_id, **campos):
    campanhas = campaign_service.ler_campanhas()
    campanha  = next((c for c in campanhas if c["id"] == campanha_id), None)
    if not campanha:
        return
    item = next((i for i in campanha["fila"] if i["lead_id"] == lead_id), None)
    if not item:
        return
    item.update(campos)
    campanha["updated_at"] = lead_service.agora()
    campaign_service.salvar_campanhas(campanhas)


def _incrementar_metrica(campanha_id, chave):
    campanhas = campaign_service.ler_campanhas()
    campanha  = next((c for c in campanhas if c["id"] == campanha_id), None)
    if not campanha:
        return
    campanha["metricas"][chave] = campanha["metricas"].get(chave, 0) + 1
    campaign_service.salvar_campanhas(campanhas)


def _finalizar_campanha(campanha_id):
    campanhas = campaign_service.ler_campanhas()
    campanha  = next((c for c in campanhas if c["id"] == campanha_id), None)
    if not campanha or campanha["status"] != campaign_service.STATUS_EXECUCAO:
        return
    campanha["status"]     = campaign_service.STATUS_FINALIZADA
    campanha["updated_at"] = lead_service.agora()
    campaign_service.salvar_campanhas(campanhas)

    notification_service.criar_notificacao(
        tipo="campanha_finalizada",
        titulo=f'Campanha "{campanha["nome"]}" finalizada',
        detalhe=f'{campanha["metricas"]["enviadas"]} mensagem(ns) enviada(s)',
    )


def _pausar_por_desconexao(campanha_id):
    campanhas = campaign_service.ler_campanhas()
    campanha  = next((c for c in campanhas if c["id"] == campanha_id), None)
    if not campanha or campanha["status"] != campaign_service.STATUS_EXECUCAO:
        return
    campanha["status"]     = campaign_service.STATUS_PAUSADA
    campanha["updated_at"] = lead_service.agora()
    campaign_service.salvar_campanhas(campanhas)
