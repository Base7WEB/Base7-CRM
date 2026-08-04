from services import import_service


def test_processar_csv_basico():
    conteudo = "Nome,Telefone,Cidade\nBarbearia A,11999998888,Campinas\n".encode("utf-8")
    resultado = import_service.processar_arquivo("teste.csv", conteudo)
    assert resultado["colunas"] == ["Nome", "Telefone", "Cidade"]
    assert resultado["linhas"] == [["Barbearia A", "11999998888", "Campinas"]]
    assert resultado["mapeamento_sugerido"]["empresa"] == 0
    assert resultado["mapeamento_sugerido"]["telefone"] == 1


def test_processar_txt_telefones_puros():
    conteudo = "11999998888\n11988887777\n".encode("utf-8")
    resultado = import_service.processar_arquivo("teste.txt", conteudo)
    assert resultado["linhas"] == [["", "11999998888"], ["", "11988887777"]]


def test_processar_txt_nome_e_telefone():
    conteudo = "Barbearia X | 11999998888\n".encode("utf-8")
    resultado = import_service.processar_arquivo("teste.txt", conteudo)
    assert resultado["linhas"] == [["Barbearia X", "11999998888"]]


def test_extensao_invalida():
    valido, ext = import_service.extensao_valida("arquivo.exe")
    assert valido is False
    assert ext == "exe"


def test_extensao_valida_csv_xlsx_txt():
    for nome in ["a.csv", "a.xlsx", "a.txt"]:
        valido, _ = import_service.extensao_valida(nome)
        assert valido is True


def test_montar_leads_aplica_mapeamento_e_normaliza_telefone():
    linhas = [["Barbearia A", "11999998888"]]
    leads = import_service.montar_leads(linhas, {"empresa": 0, "telefone": 1})
    assert leads[0]["empresa"] == "Barbearia A"
    assert leads[0]["telefone_normalizado"] == "5511999998888"


def test_montar_leads_ignora_linha_vazia():
    leads = import_service.montar_leads([["", ""]], {"empresa": 0, "telefone": 1})
    assert leads == []
