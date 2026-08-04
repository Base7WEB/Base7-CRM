import json
import os
import uuid
from datetime import datetime

from whatsapp import normalizar_telefone

BASE_DIR  = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))  # backend/
DATA_DIR  = os.path.join(BASE_DIR, "data")
DATA_FILE = os.path.join(DATA_DIR, "leads.json")

os.makedirs(DATA_DIR, exist_ok=True)


def agora():
    return datetime.now().isoformat(timespec="seconds")


def ler_leads():
    if not os.path.exists(DATA_FILE):
        return []
    with open(DATA_FILE, "r", encoding="utf-8") as f:
        try:
            return json.load(f)
        except json.JSONDecodeError:
            return []


def salvar_leads(leads):
    with open(DATA_FILE, "w", encoding="utf-8") as f:
        json.dump(leads, f, ensure_ascii=False, indent=2)


def calcular_score(lead):
    score = 0
    if lead.get("site"):                      score += 25
    if lead.get("telefone"):                  score += 20
    if lead.get("instagram"):                 score += 15
    if lead.get("valor", 0) > 3000:           score += 20
    if lead.get("followup"):                  score += 10
    if lead.get("rating_google", 0) >= 4.0:   score += 10
    if lead.get("reviews_google", 0) > 50:    score += 10
    return min(score, 100)


# Traduz o código curto de "proxima_acao" que a IA de conversação devolve
# (services/ai_conversation_service.py) para um texto legível na UI.
ACOES_IA_TEXTO = {
    "apresentar_sistema": "Apresentar o sistema/produto ao lead",
    "apresentar_preco":   "Apresentar valores e condições",
    "agendar_reuniao":    "Agendar uma reunião",
    "enviar_demo":        "Enviar demonstração/material",
    "responder_objecao":  "Responder à objeção levantada pelo lead",
    "aguardar_resposta":  "Aguardar resposta do lead",
    "encerrar_contato":   "Encerrar contato — sem interesse",
    "chamar_vendedor":    "Atenção: chamar um vendedor humano",
}


def sugerir_proxima_acao(lead):
    """Gera sugestão de próxima ação. A análise mais recente da IA de conversação
    (quando existir) tem prioridade sobre as regras determinísticas — a IA
    complementa a regra, não a substitui por completo (seção 31 do plano)."""
    analise_ia = lead.get("ultima_analise_ia")
    if analise_ia and analise_ia.get("proxima_acao"):
        texto  = ACOES_IA_TEXTO.get(analise_ia["proxima_acao"], analise_ia["proxima_acao"])
        prefixo = "🔥 " if lead.get("temperatura") == "quente" else ""
        return f"{prefixo}{texto} (sugestão da IA)"

    status   = lead.get("status", "Novo")
    followup = lead.get("followup", "")
    hoje     = datetime.now().strftime("%Y-%m-%d")
    historico = lead.get("historico", [])

    ultimo_contato = ""
    if historico:
        ultimo_contato = historico[-1].get("data", "")[:10]

    dias_sem_atividade = 0
    if ultimo_contato:
        try:
            d = datetime.strptime(ultimo_contato, "%Y-%m-%d")
            dias_sem_atividade = (datetime.now() - d).days
        except Exception:
            pass

    if followup and followup < hoje:
        return f"Follow-up vencido em {followup} — entre em contato imediatamente"

    regras = {
        "Novo":       "Fazer primeiro contato via WhatsApp ou ligação",
        "Contato":    "Qualificar interesse e agendar reunião de apresentação",
        "Reunião":    "Preparar proposta personalizada com base na reunião",
        "Proposta":   "Fazer follow-up da proposta enviada — confirmar recebimento",
        "Negociação": "Esclarecer objeções e fechar condições finais",
        "Cliente":    "Enviar onboarding, coletar feedback e solicitar indicações",
        "Perdido":    "Entender motivo da perda e registrar para melhorias futuras",
    }

    base = regras.get(status, "Atualizar status do lead")

    if dias_sem_atividade > 14:
        return f"URGENTE ({dias_sem_atividade} dias sem atividade): {base}"
    if dias_sem_atividade > 7:
        return f"Atenção ({dias_sem_atividade} dias sem atividade): {base}"

    return base


def obter_lead(lead_id):
    return next((l for l in ler_leads() if l["id"] == lead_id), None)


def obter_lead_por_telefone(telefone_normalizado):
    if not telefone_normalizado:
        return None
    for l in ler_leads():
        tel = l.get("telefone_normalizado") or normalizar_telefone(l.get("telefone", ""))
        if tel == telefone_normalizado:
            return l
    return None


def criar_lead_minimo(empresa, telefone, telefone_normalizado, origem="WhatsApp"):
    """Cria um lead mínimo a partir de um contato desconhecido (seção 25 do plano) —
    garante que nenhuma mensagem recebida seja perdida por falta de lead correspondente."""
    leads = ler_leads()
    lead = {
        "id":                   str(uuid.uuid4()),
        "empresa":              empresa,
        "responsavel":          "",
        "nicho":                "",
        "cidade":               "",
        "endereco":             "",
        "telefone":             telefone,
        "telefone_normalizado": telefone_normalizado,
        "instagram":            "",
        "site":                 "",
        "email":                "",
        "valor":                0.0,
        "origem":               origem,
        "status":               "Novo",
        "rating_google":        0.0,
        "reviews_google":       0,
        "followup":             "",
        "obs":                  "",
        "tags":                 ["contato-desconhecido"] if empresa.startswith("Contato") else [],
        "tasks":                [],
        "historico":            [{"data": agora(), "acao": f"Lead criado automaticamente a partir de mensagem recebida via {origem}"}],
        "criadoEm":             agora(),
        "atualizadoEm":         agora(),
        "statusChangedAt":      agora(),
    }
    lead["score"] = calcular_score(lead)
    leads.append(lead)
    salvar_leads(leads)
    return lead


def atualizar_lead(lead_id, mutador):
    """Aplica `mutador(lead) -> None` sobre o lead e persiste. Retorna o lead atualizado ou None."""
    leads = ler_leads()
    idx = next((i for i, l in enumerate(leads) if l["id"] == lead_id), None)
    if idx is None:
        return None
    mutador(leads[idx])
    leads[idx]["atualizadoEm"] = agora()
    salvar_leads(leads)
    return leads[idx]


def adicionar_historico(lead_id, acao):
    def _mut(lead):
        lead.setdefault("historico", []).append({"data": agora(), "acao": acao})
    return atualizar_lead(lead_id, _mut)


def importar_leads(novos):
    """Importa leads em lote com deduplicação por telefone_normalizado e,
    na ausência de telefone, por nome + cidade (seção 12 do plano)."""
    leads_atuais = ler_leads()

    telefones_atuais = set()
    for l in leads_atuais:
        tel_norm = l.get("telefone_normalizado") or normalizar_telefone(l.get("telefone", ""))
        if tel_norm:
            l["telefone_normalizado"] = tel_norm
            telefones_atuais.add(tel_norm)

    nomes_cidades_atuais = {
        (l["empresa"].lower().strip(), (l.get("cidade") or "").lower().strip())
        for l in leads_atuais
    }

    importados = []
    duplicados = []

    for n in novos:
        nome     = n.get("empresa", "").strip()
        telefone = n.get("telefone", "").strip()
        if not nome and not telefone:
            continue
        if not nome:
            nome = f"Contato {telefone}"

        cidade   = n.get("cidade", "").strip()
        tel_norm = normalizar_telefone(telefone) if telefone else ""

        if tel_norm and tel_norm in telefones_atuais:
            duplicados.append(nome)
            continue
        if (nome.lower(), cidade.lower()) in nomes_cidades_atuais:
            duplicados.append(nome)
            continue

        lead = {
            "id":                  str(uuid.uuid4()),
            "empresa":             nome,
            "responsavel":         n.get("responsavel", ""),
            "nicho":               n.get("nicho", ""),
            "cidade":              cidade,
            "endereco":            n.get("endereco", ""),
            "telefone":            telefone,
            "telefone_normalizado": tel_norm,
            "instagram":           n.get("instagram", ""),
            "site":                n.get("site", ""),
            "email":               n.get("email", ""),
            "valor":               float(n.get("valor", 0) or 0),
            "origem":              n.get("origem", "Importação"),
            "status":              "Novo",
            "rating_google":       float(n.get("rating_google", 0) or 0),
            "reviews_google":      int(n.get("reviews_google", 0) or 0),
            "followup":            "",
            "obs":                 n.get("obs", ""),
            "tags":                n.get("tags", []),
            "tasks":               [],
            "historico":           [{"data": agora(), "acao": f"Lead importado via {n.get('origem','Importação')}"}],
            "criadoEm":            agora(),
            "atualizadoEm":        agora(),
            "statusChangedAt":     agora(),
        }
        lead["score"] = calcular_score(lead)

        leads_atuais.append(lead)
        importados.append(lead)
        if tel_norm:
            telefones_atuais.add(tel_norm)
        nomes_cidades_atuais.add((nome.lower(), cidade.lower()))

    salvar_leads(leads_atuais)
    return importados, duplicados
