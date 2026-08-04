from services import lead_service


def test_importar_leads_dedup_por_telefone(isolated_data):
    importados, duplicados = lead_service.importar_leads([
        {"empresa": "Barbearia A", "telefone": "11999998888"},
    ])
    assert len(importados) == 1
    assert duplicados == []

    importados2, duplicados2 = lead_service.importar_leads([
        {"empresa": "Nome Diferente", "telefone": "(11) 99999-8888"},
    ])
    assert importados2 == []
    assert duplicados2 == ["Nome Diferente"]


def test_importar_leads_dedup_por_nome_cidade_sem_telefone(isolated_data):
    lead_service.importar_leads([{"empresa": "Salao X", "cidade": "Campinas"}])
    importados, duplicados = lead_service.importar_leads([{"empresa": "Salao X", "cidade": "Campinas"}])
    assert importados == []
    assert duplicados == ["Salao X"]


def test_importar_leads_sem_nome_usa_telefone_como_nome(isolated_data):
    importados, _ = lead_service.importar_leads([{"telefone": "11988887777"}])
    assert importados[0]["empresa"] == "Contato 11988887777"


def test_importar_leads_ignora_linha_totalmente_vazia(isolated_data):
    importados, duplicados = lead_service.importar_leads([{"empresa": "", "telefone": ""}])
    assert importados == []
    assert duplicados == []


def test_calcular_score_maximo():
    lead = {
        "site": "x", "telefone": "y", "instagram": "z", "valor": 5000,
        "followup": "2026-01-01", "rating_google": 4.5, "reviews_google": 100,
    }
    assert lead_service.calcular_score(lead) == 100


def test_calcular_score_zero():
    assert lead_service.calcular_score({}) == 0


def test_sugerir_proxima_acao_usa_analise_ia_quando_presente():
    lead = {
        "status": "Novo", "temperatura": "quente",
        "ultima_analise_ia": {"proxima_acao": "chamar_vendedor"},
    }
    resultado = lead_service.sugerir_proxima_acao(lead)
    assert "chamar um vendedor humano" in resultado
    assert resultado.startswith("🔥")


def test_sugerir_proxima_acao_fallback_regra_padrao_sem_analise_ia():
    lead = {"status": "Novo", "historico": []}
    resultado = lead_service.sugerir_proxima_acao(lead)
    assert "WhatsApp ou ligação" in resultado
