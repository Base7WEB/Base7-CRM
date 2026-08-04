from services import action_engine, config_service, lead_service, notification_service


def test_categorias_escalonamento_nunca_respondem_automaticamente(isolated_data):
    # Tenta forçar via config, inclusive as categorias de escalonamento.
    config_service.salvar_config({
        "ia_automacao_nivel": "automatica",
        "ia_auto_contratar": True,
        "ia_auto_negociacao": True,
        "ia_auto_reclamacao": True,
    })
    for intencao in action_engine.CATEGORIAS_ESCALONAMENTO:
        assert action_engine._pode_responder_automaticamente(intencao) is False


def test_categoria_liberada_com_toggle_ligado(isolated_data):
    config_service.salvar_config({"ia_automacao_nivel": "automatica", "ia_auto_preco": True})
    assert action_engine._pode_responder_automaticamente("pergunta_preco") is True


def test_categoria_bloqueada_sem_nivel_automatico(isolated_data):
    config_service.salvar_config({"ia_automacao_nivel": "analise", "ia_auto_preco": True})
    assert action_engine._pode_responder_automaticamente("pergunta_preco") is False


def test_categoria_bloqueada_sem_toggle_ligado(isolated_data):
    config_service.salvar_config({"ia_automacao_nivel": "automatica", "ia_auto_preco": False})
    assert action_engine._pode_responder_automaticamente("pergunta_preco") is False


def test_processar_analise_escalona_atualiza_lead_e_notifica(isolated_data):
    lead = lead_service.criar_lead_minimo("Lead X", "11999997777", "5511999997777")
    resultado = action_engine.processar_analise(lead["id"], {
        "intencao": "quer_contratar", "temperatura": "quente", "proxima_acao": "chamar_vendedor",
    })
    assert resultado["escalonado"] is True
    assert resultado["status_sugerido"] == "Negociação"

    lead_atualizado = lead_service.obter_lead(lead["id"])
    assert lead_atualizado["atencao_necessaria"] is True
    assert lead_atualizado["intencao_atual"] == "quer_contratar"
    assert lead_atualizado["temperatura"] == "quente"

    notificacoes = notification_service.ler_notificacoes()
    assert len(notificacoes) == 1
    assert notificacoes[0]["tipo"] == "lead_quente"
    assert notificacoes[0]["lead_id"] == lead["id"]


def test_processar_analise_sem_escalonamento_nao_notifica(isolated_data):
    lead = lead_service.criar_lead_minimo("Lead Y", "11999996666", "5511999996666")
    resultado = action_engine.processar_analise(lead["id"], {
        "intencao": "quer_informacoes", "temperatura": "morno", "proxima_acao": "apresentar_sistema",
    })
    assert resultado["escalonado"] is False
    assert notification_service.ler_notificacoes() == []
