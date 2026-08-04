from services import template_service


def test_templates_vazio_por_padrao(isolated_data):
    assert template_service.ler_templates() == {}


def test_salvar_e_ler_templates(isolated_data):
    dados = {"Novo": [{"nome": "Boas-vindas", "texto": "Oi {empresa}"}]}
    template_service.salvar_templates(dados)
    assert template_service.ler_templates() == dados
