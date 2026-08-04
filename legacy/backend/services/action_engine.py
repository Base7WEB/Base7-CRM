from services import campaign_service, config_service, lead_service, notification_service

# Categorias que SEMPRE escalam para um humano — regra fixa, nunca desligável
# por configuração (seções 37/64 do plano).
CATEGORIAS_ESCALONAMENTO = {"quer_contratar", "negociacao", "reclamacao", "pedir_contato_humano"}

# Mapeia intenção -> chave de config do toggle "responder automaticamente".
# quer_contratar/negociacao/reclamacao ficam de fora de propósito: mesmo que a
# tela de Configurações exiba um toggle para elas (seção 36), estão em
# CATEGORIAS_ESCALONAMENTO e por isso nunca respondem automaticamente — a
# ausência de entrada aqui é o que torna essa trava estrutural, não apenas
# uma convenção de configuração.
CATEGORIAS_TOGGLE_CONFIG = {
    "quer_informacoes": "ia_auto_perguntas_simples",
    "pergunta_preco":   "ia_auto_preco",
    "quer_reuniao":     "ia_auto_reuniao",
}

# Sugestões de mudança de estágio no pipeline — nunca aplicadas automaticamente
# (seção 45 do plano: "não realizar mudanças críticas sem configuração explícita").
SUGESTAO_STATUS_POR_INTENCAO = {
    "interessado":    "Contato",
    "quer_reuniao":   "Reunião",
    "quer_contratar": "Negociação",
}

TITULOS_ESCALONAMENTO = {
    "quer_contratar":       "quer contratar!",
    "negociacao":           "está em negociação",
    "reclamacao":           "fez uma reclamação",
    "pedir_contato_humano": "pediu para falar com um humano",
}


def processar_analise(lead_id, analise):
    """Orquestra as consequências de uma análise de IA sobre uma conversa:
    atualiza o lead, cancela follow-ups pendentes de campanha e cria uma
    notificação quando a categoria exige atenção humana (seções 37/45/50).

    Retorna {"escalonado": bool, "status_sugerido": str|None}.
    """
    intencao  = analise.get("intencao")
    escalonar = intencao in CATEGORIAS_ESCALONAMENTO

    _atualizar_lead(lead_id, analise, escalonar)
    _cancelar_followups_pendentes(lead_id)

    if escalonar:
        _notificar_atencao_necessaria(lead_id, intencao)

    respondido_automaticamente = False
    if _pode_responder_automaticamente(intencao):
        respondido_automaticamente = _responder_automaticamente(lead_id)

    return {
        "escalonado":                 escalonar,
        "status_sugerido":            SUGESTAO_STATUS_POR_INTENCAO.get(intencao),
        "respondido_automaticamente": respondido_automaticamente,
    }


def _pode_responder_automaticamente(intencao):
    """Nível 3 (seções 35-37 do plano): só responde sozinho se o nível de
    automação estiver em 'automatica' E a categoria tiver toggle ligado E a
    categoria não for de escalonamento obrigatório."""
    if intencao in CATEGORIAS_ESCALONAMENTO:
        return False

    cfg = config_service.ler_config()
    if cfg.get("ia_automacao_nivel", "analise") != "automatica":
        return False

    chave_toggle = CATEGORIAS_TOGGLE_CONFIG.get(intencao)
    if not chave_toggle:
        return False

    return bool(cfg.get(chave_toggle, False))


def _responder_automaticamente(lead_id):
    # Imports tardios: ai_conversation_service importa action_engine no nível
    # do módulo, então um import no topo aqui criaria um ciclo.
    from services import ai_conversation_service
    from services.whatsapp_service import whatsapp_service

    resposta, erro, _status = ai_conversation_service.gerar_resposta(lead_id)
    if erro or not resposta:
        return False

    resultado, _http = whatsapp_service.send_to_lead(lead_id, resposta)
    if resultado.get("ok"):
        lead_service.adicionar_historico(lead_id, "Resposta enviada automaticamente pela IA")
        return True
    return False


def _atualizar_lead(lead_id, analise, escalonar):
    def _mut(lead):
        lead["intencao_atual"]     = analise.get("intencao")
        lead["temperatura"]        = analise.get("temperatura")
        lead["ultima_analise_ia"]  = analise
        lead["atencao_necessaria"] = escalonar

    lead_service.atualizar_lead(lead_id, _mut)


def _cancelar_followups_pendentes(lead_id):
    """O worker de campanha já ignora leads que responderam ao checar a conversa
    a cada tick (services/campaign_worker.py); aqui marcamos explicitamente no
    momento da resposta, para refletir de imediato na visualização da fila."""
    campanhas = campaign_service.ler_campanhas()
    alterado  = False

    for campanha in campanhas:
        total_followups = len(campanha.get("followups", []))
        if not total_followups:
            continue
        for item in campanha.get("fila", []):
            if (item.get("lead_id") == lead_id and item.get("status") == "enviado"
                    and item.get("followups_enviados", 0) < total_followups):
                item["followups_enviados"] = total_followups
                item["erro"] = "Follow-up cancelado: lead respondeu"
                alterado = True

    if alterado:
        campaign_service.salvar_campanhas(campanhas)


def _notificar_atencao_necessaria(lead_id, intencao):
    lead    = lead_service.obter_lead(lead_id)
    empresa = lead["empresa"] if lead else "Lead"
    motivo  = TITULOS_ESCALONAMENTO.get(intencao, "precisa de atenção")

    tipo = "lead_quente" if intencao in ("quer_contratar", "negociacao") else "atencao_necessaria"
    notification_service.criar_notificacao(
        tipo=tipo,
        titulo=f"{empresa} {motivo}",
        lead_id=lead_id,
        detalhe=intencao,
    )
