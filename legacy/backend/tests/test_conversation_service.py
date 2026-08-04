from unittest.mock import MagicMock, patch

from services import conversation_service, lead_service


def _mock_claude_response(texto_json):
    resposta = MagicMock()
    resposta.content = [MagicMock(text=texto_json)]
    return resposta


def test_processar_mensagem_recebida_cria_lead_desconhecido(isolated_data):
    with patch("services.claude_client.anthropic.Anthropic") as MockAnthropic:
        MockAnthropic.return_value.messages.create.return_value = _mock_claude_response(
            '{"intencao": "quer_informacoes", "temperatura": "morno", "proxima_acao": "apresentar_sistema"}'
        )
        lead = conversation_service.processar_mensagem_recebida("11999995555", None, "Oi, quem é?")

    assert lead["empresa"] == "Contato 11999995555"
    assert "contato-desconhecido" in lead["tags"]

    conversa = conversation_service.obter_conversa_por_lead(lead["id"])
    assert len(conversa["mensagens"]) == 1
    assert conversa["mensagens"][0]["direcao"] == "recebida"


def test_processar_mensagem_recebida_reaproveita_lead_existente(isolated_data):
    lead_existente = lead_service.criar_lead_minimo("Barbearia Y", "11999994444", "5511999994444")

    with patch("services.claude_client.anthropic.Anthropic") as MockAnthropic:
        MockAnthropic.return_value.messages.create.return_value = _mock_claude_response(
            '{"intencao": "pergunta_preco", "temperatura": "quente", "proxima_acao": "apresentar_preco"}'
        )
        lead = conversation_service.processar_mensagem_recebida("11999994444", None, "Quanto custa?")

    assert lead["id"] == lead_existente["id"]
    assert len(lead_service.ler_leads()) == 1  # não duplicou


def test_processar_mensagem_recebida_sem_texto_nao_faz_nada(isolated_data):
    resultado = conversation_service.processar_mensagem_recebida("11999993333", "Nome", "")
    assert resultado is None
    assert lead_service.ler_leads() == []
