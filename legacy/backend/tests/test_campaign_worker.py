from unittest.mock import patch

from services import campaign_service, campaign_worker, lead_service


def test_renderizar_mensagem_substitui_variaveis():
    lead = {
        "empresa": "Barbearia X", "cidade": "Campinas", "nicho": "Barbearia",
        "responsavel": "", "rating_google": 0, "site": "", "instagram": "",
    }
    texto = campaign_worker._renderizar_mensagem("Ola {empresa}, de {cidade}!", lead)
    assert texto == "Ola Barbearia X, de Campinas!"


def test_worker_modo_teste_nao_chama_whatsapp_real(isolated_data):
    lead = lead_service.criar_lead_minimo("Lead Teste", "11999998888", "5511999998888")
    campanha = campaign_service.criar_campanha({
        "nome": "C", "leads": [lead["id"]], "template": {"nome": "t", "texto": "oi {empresa}"},
        "configuracoes": {"modo_teste": True},
    })
    campaign_service.iniciar_campanha(campanha["id"])

    with patch("services.campaign_worker.whatsapp_service.send_to_lead") as mock_send:
        cfg = campaign_worker._tentar_processar_fila_principal()
        assert cfg is not None
        mock_send.assert_not_called()

    item = campaign_service.ler_campanhas()[0]["fila"][0]
    assert item["status"] == "enviado"
    assert item["simulado"] is True


def test_worker_pausa_campanha_se_whatsapp_desconectado(isolated_data):
    lead = lead_service.criar_lead_minimo("Lead Teste", "11999998888", "5511999998888")
    campanha = campaign_service.criar_campanha({
        "nome": "C", "leads": [lead["id"]], "template": {"nome": "t", "texto": "oi"},
        "configuracoes": {"modo_teste": False},
    })
    campaign_service.iniciar_campanha(campanha["id"])

    with patch("services.campaign_worker.whatsapp_service.status", return_value={"conectado": False}):
        campaign_worker._tentar_processar_fila_principal()

    campanha_atualizada = campaign_service.obter_campanha(campanha["id"])
    assert campanha_atualizada["status"] == campaign_service.STATUS_PAUSADA


def test_worker_finaliza_campanha_quando_fila_vazia(isolated_data):
    campanha = campaign_service.criar_campanha({
        "nome": "C", "leads": [], "template": {"nome": "t", "texto": "oi"},
    })
    campanhas = campaign_service.ler_campanhas()
    campanhas[0]["status"] = campaign_service.STATUS_EXECUCAO
    campaign_service.salvar_campanhas(campanhas)

    campaign_worker._tentar_processar_fila_principal()

    campanha_atualizada = campaign_service.obter_campanha(campanha["id"])
    assert campanha_atualizada["status"] == campaign_service.STATUS_FINALIZADA
