from services import lead_service


def test_backup_restore_round_trip(isolated_data):
    lead_service.criar_lead_minimo("Lead 1", "11999998888", "5511999998888")
    lead_service.criar_lead_minimo("Lead 2", "11988887777", "5511988887777")

    backup = lead_service.ler_leads()
    assert len(backup) == 2

    lead_service.salvar_leads([])
    assert lead_service.ler_leads() == []

    lead_service.salvar_leads(backup)
    restaurado = lead_service.ler_leads()
    assert len(restaurado) == 2
    assert {l["empresa"] for l in restaurado} == {"Lead 1", "Lead 2"}


def test_restore_leads_vazio_limpa_base(isolated_data):
    lead_service.criar_lead_minimo("Lead 1", "11999998888", "5511999998888")
    assert len(lead_service.ler_leads()) == 1

    lead_service.salvar_leads([])
    assert lead_service.ler_leads() == []
