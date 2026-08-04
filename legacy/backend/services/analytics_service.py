from datetime import datetime

from services import campaign_service, conversation_service, lead_service

TEMPERATURAS_INTERESSADO = ("quente", "morno")


def dashboard_whatsapp():
    """Métricas do dia + campanha ativa, para o painel Dashboard do módulo WhatsApp (seção 8)."""
    conversas = conversation_service.ler_conversas()
    hoje = datetime.now().strftime("%Y-%m-%d")

    mensagens_hoje  = 0
    respostas       = 0
    leads_contatados_hoje = set()

    for conv in conversas:
        for m in conv.get("mensagens", []):
            if m.get("data", "")[:10] == hoje:
                mensagens_hoje += 1
                leads_contatados_hoje.add(conv["lead_id"])
            if m.get("direcao") == "recebida":
                respostas += 1

    leads    = lead_service.ler_leads()
    quentes  = [l for l in leads if l.get("temperatura") == "quente"]
    interessados = sum(1 for l in leads if l.get("temperatura") in TEMPERATURAS_INTERESSADO)

    total_contatados = len(conversas)
    taxa_resposta = round(respostas / total_contatados * 100, 1) if total_contatados else 0

    campanha_ativa = next(
        (c for c in campaign_service.ler_campanhas() if c["status"] == campaign_service.STATUS_EXECUCAO),
        None,
    )

    return {
        "mensagens_hoje":   mensagens_hoje,
        "leads_contatados": len(leads_contatados_hoje),
        "respostas":        respostas,
        "interessados":     interessados,
        "taxa_resposta":    taxa_resposta,
        "leads_quentes":    [{"id": l["id"], "empresa": l["empresa"]} for l in quentes[:10]],
        "campanha_ativa":   _resumo_campanha(campanha_ativa) if campanha_ativa else None,
    }


def _resumo_campanha(campanha):
    total    = len(campanha.get("leads", []))
    enviadas = campanha["metricas"]["enviadas"]
    return {
        "id":             campanha["id"],
        "nome":           campanha["nome"],
        "enviadas":       enviadas,
        "total":          total,
        "progresso_pct":  round(enviadas / total * 100, 1) if total else 0,
    }


def metricas_gerais():
    """Funil de conversas ponta a ponta (seção 42)."""
    conversas = conversation_service.ler_conversas()
    leads_map = {l["id"]: l for l in lead_service.ler_leads()}

    enviadas = recebidas = 0
    leads_com_resposta = set()
    for conv in conversas:
        for m in conv.get("mensagens", []):
            if m.get("direcao") == "enviada":
                enviadas += 1
            else:
                recebidas += 1
                leads_com_resposta.add(conv["lead_id"])

    total_contatados = len(conversas)
    interessados = sum(1 for l in leads_map.values() if l.get("temperatura") in TEMPERATURAS_INTERESSADO)
    reunioes  = sum(1 for l in leads_map.values() if l.get("status") == "Reunião")
    propostas = sum(1 for l in leads_map.values() if l.get("status") == "Proposta")
    clientes  = sum(1 for l in leads_map.values() if l.get("status") == "Cliente")

    def taxa(n, d):
        return round(n / d * 100, 1) if d else 0

    return {
        "mensagens_enviadas":  enviadas,
        "mensagens_recebidas": recebidas,
        "respostas":           len(leads_com_resposta),
        "leads_interessados":  interessados,
        "reunioes":            reunioes,
        "propostas":           propostas,
        "clientes":            clientes,
        "taxas": {
            "resposta":  taxa(len(leads_com_resposta), total_contatados),
            "interesse": taxa(interessados, total_contatados),
            "reuniao":   taxa(reunioes, total_contatados),
            "proposta":  taxa(propostas, total_contatados),
            "conversao": taxa(clientes, total_contatados),
        },
    }


def metricas_por_template():
    """Compara desempenho das campanhas agrupadas pelo nome do template (seção 43)."""
    leads_map = {l["id"]: l for l in lead_service.ler_leads()}
    conversas_por_lead = {c["lead_id"]: c for c in conversation_service.ler_conversas()}

    agrupado = {}
    for campanha in campaign_service.ler_campanhas():
        nome_template = campanha.get("template", {}).get("nome") or "(sem nome)"
        stats = agrupado.setdefault(nome_template, {
            "template": nome_template, "enviadas": 0, "respostas": 0,
            "interessados": 0, "reunioes": 0, "clientes": 0,
        })
        for item in campanha.get("fila", []):
            if item.get("status") != "enviado":
                continue
            stats["enviadas"] += 1

            conv = conversas_por_lead.get(item["lead_id"])
            if conv and any(m.get("direcao") == "recebida" for m in conv.get("mensagens", [])):
                stats["respostas"] += 1

            lead = leads_map.get(item["lead_id"])
            if lead:
                if lead.get("temperatura") in TEMPERATURAS_INTERESSADO:
                    stats["interessados"] += 1
                if lead.get("status") == "Reunião":
                    stats["reunioes"] += 1
                if lead.get("status") == "Cliente":
                    stats["clientes"] += 1

    resultado = list(agrupado.values())
    for s in resultado:
        s["taxa_resposta"] = round(s["respostas"] / s["enviadas"] * 100, 1) if s["enviadas"] else 0
    resultado.sort(key=lambda s: s["enviadas"], reverse=True)
    return resultado


def metricas_por_nicho():
    """Compara taxa de resposta/interesse entre nichos de leads contatados (seção 44)."""
    conversas_por_lead = {c["lead_id"]: c for c in conversation_service.ler_conversas()}

    agrupado = {}
    for lead in lead_service.ler_leads():
        conv = conversas_por_lead.get(lead["id"])
        if not conv or not conv.get("mensagens"):
            continue  # só entram leads efetivamente contatados via WhatsApp

        nicho = lead.get("nicho") or "(sem nicho)"
        stats = agrupado.setdefault(nicho, {"nicho": nicho, "contatados": 0, "respostas": 0, "interessados": 0})
        stats["contatados"] += 1
        if any(m.get("direcao") == "recebida" for m in conv.get("mensagens", [])):
            stats["respostas"] += 1
        if lead.get("temperatura") in TEMPERATURAS_INTERESSADO:
            stats["interessados"] += 1

    resultado = list(agrupado.values())
    for s in resultado:
        s["taxa_resposta"]  = round(s["respostas"] / s["contatados"] * 100, 1) if s["contatados"] else 0
        s["taxa_interesse"] = round(s["interessados"] / s["contatados"] * 100, 1) if s["contatados"] else 0
    resultado.sort(key=lambda s: s["contatados"], reverse=True)
    return resultado
