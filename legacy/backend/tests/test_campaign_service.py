from services import campaign_service


def test_criar_campanha_gera_fila_pendente(isolated_data):
    campanha = campaign_service.criar_campanha({
        "nome": "Campanha X", "leads": ["l1", "l2"],
        "template": {"nome": "t", "texto": "oi"},
    })
    assert campanha["status"] == campaign_service.STATUS_RASCUNHO
    assert len(campanha["fila"]) == 2
    assert all(item["status"] == "pendente" for item in campanha["fila"])


def test_iniciar_campanha_impede_duas_simultaneas(isolated_data):
    c1 = campaign_service.criar_campanha({"nome": "C1", "leads": ["l1"], "template": {}})
    c2 = campaign_service.criar_campanha({"nome": "C2", "leads": ["l2"], "template": {}})

    campanha, erro = campaign_service.iniciar_campanha(c1["id"])
    assert erro is None
    assert campanha["status"] == campaign_service.STATUS_EXECUCAO

    campanha2, erro2 = campaign_service.iniciar_campanha(c2["id"])
    assert campanha2 is None
    assert "em execução" in erro2


def test_pausar_retomar_parar_campanha(isolated_data):
    c = campaign_service.criar_campanha({"nome": "C", "leads": ["l1"], "template": {}})
    campaign_service.iniciar_campanha(c["id"])

    pausada, erro = campaign_service.pausar_campanha(c["id"])
    assert erro is None and pausada["status"] == campaign_service.STATUS_PAUSADA

    retomada, erro = campaign_service.retomar_campanha(c["id"])
    assert erro is None and retomada["status"] == campaign_service.STATUS_EXECUCAO

    parada, erro = campaign_service.parar_campanha(c["id"])
    assert erro is None and parada["status"] == campaign_service.STATUS_CANCELADA


def test_nao_pode_pausar_rascunho(isolated_data):
    c = campaign_service.criar_campanha({"nome": "C", "leads": ["l1"], "template": {}})
    campanha, erro = campaign_service.pausar_campanha(c["id"])
    assert campanha is None
    assert erro is not None


def test_pular_item_fila(isolated_data):
    c = campaign_service.criar_campanha({"nome": "C", "leads": ["l1"], "template": {}})
    campanha, erro = campaign_service.pular_item_fila(c["id"], "l1")
    assert erro is None
    assert campanha["fila"][0]["status"] == "pulado"


def test_deletar_campanha(isolated_data):
    c = campaign_service.criar_campanha({"nome": "C", "leads": ["l1"], "template": {}})
    assert campaign_service.deletar_campanha(c["id"]) is True
    assert campaign_service.obter_campanha(c["id"]) is None
    assert campaign_service.deletar_campanha(c["id"]) is False
