from whatsapp.utils import formatar_telefone_exibicao, normalizar_telefone


def test_normaliza_numero_com_ddd_sem_ddi():
    assert normalizar_telefone("(11) 99999-8888") == "5511999998888"


def test_normaliza_numero_ja_com_ddi():
    assert normalizar_telefone("5511999998888") == "5511999998888"


def test_normaliza_numero_fixo_10_digitos():
    assert normalizar_telefone("11 3275-3094") == "551132753094"


def test_normaliza_remove_zero_inicial():
    assert normalizar_telefone("011999998888") == "5511999998888"


def test_normaliza_string_vazia_ou_none():
    assert normalizar_telefone("") == ""
    assert normalizar_telefone(None) == ""


def test_formatar_exibicao_celular():
    assert formatar_telefone_exibicao("5511999998888") == "(11) 99999-8888"


def test_formatar_exibicao_fixo():
    assert formatar_telefone_exibicao("551132753094") == "(11) 3275-3094"
