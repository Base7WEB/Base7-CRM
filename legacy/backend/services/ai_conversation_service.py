from services import action_engine, claude_client, conversation_service, knowledge_base_service, lead_service

CATEGORIAS_INTENCAO = [
    "interessado", "quer_informacoes", "pergunta_preco", "quer_demonstracao",
    "quer_reuniao", "quer_contratar", "negociacao", "objecao_preco",
    "objecao_tempo", "nao_interessado", "sem_resposta", "pedir_contato_humano",
    "reclamacao", "fora_do_contexto",
]


def _montar_prompt(lead, conversa):
    mensagens = conversa.get("mensagens", [])
    linhas = []
    for m in mensagens[-20:]:  # janela de contexto razoável para a análise
        quem = "Base7" if m.get("direcao") == "enviada" else "Lead"
        linhas.append(f"{quem}: {m.get('texto', '')}")
    historico_conversa = "\n".join(linhas) or "(sem mensagens)"

    return f"""Você é um assistente de vendas B2B analisando uma conversa de WhatsApp.

Lead:
- Empresa: {lead.get('empresa', '?')}
- Nicho: {lead.get('nicho', '?')} | Cidade: {lead.get('cidade', '?')}
- Status no CRM: {lead.get('status', '?')} | Score: {lead.get('score', 0)}

Conversa (da mais antiga para a mais recente):
{historico_conversa}

Classifique a intenção da ÚLTIMA mensagem do lead, considerando todo o contexto da conversa acima.
Categorias possíveis: {', '.join(CATEGORIAS_INTENCAO)}

Responda APENAS com este JSON (sem texto fora do JSON):
{{"intencao":"pergunta_preco","temperatura":"quente","score":92,"urgencia":"alta","objecao":null,"proxima_acao":"apresentar_preco","confianca":0.94}}

temperatura deve ser "quente", "morno" ou "frio". urgencia deve ser "alta", "media" ou "baixa"."""


def analisar_conversa(lead_id):
    """Retorna (analise, erro, http_status)."""
    lead = lead_service.obter_lead(lead_id)
    if not lead:
        return None, "Lead não encontrado", 404

    conversa = conversation_service.obter_conversa_por_lead(lead_id)
    if not conversa or not conversa.get("mensagens"):
        return None, "Esta conversa ainda não tem mensagens para analisar", 400

    prompt = _montar_prompt(lead, conversa)
    dados, erro, http_status = claude_client.perguntar_json(prompt, max_tokens=300)
    if erro:
        return None, erro, http_status

    conversation_service.salvar_analise_ia(lead_id, dados)
    resultado_acao = action_engine.processar_analise(lead_id, dados)
    return {**dados, "status_sugerido": resultado_acao.get("status_sugerido")}, None, 200


def _montar_prompt_resposta(lead, conversa):
    mensagens = conversa.get("mensagens", [])
    linhas = []
    for m in mensagens[-20:]:
        quem = "Base7" if m.get("direcao") == "enviada" else "Lead"
        linhas.append(f"{quem}: {m.get('texto', '')}")
    historico_conversa = "\n".join(linhas) or "(sem mensagens)"

    base_conhecimento = knowledge_base_service.formatar_para_prompt()

    return f"""Você é um vendedor da Base7 Web conversando por WhatsApp com um lead.

Lead:
- Empresa: {lead.get('empresa', '?')}
- Nicho: {lead.get('nicho', '?')} | Cidade: {lead.get('cidade', '?')}

Conversa até agora (da mais antiga para a mais recente):
{historico_conversa}

Base de conhecimento comercial da Base7 (USE SOMENTE estas informações — nunca invente preço, prazo, funcionalidade ou condição que não esteja aqui; se a pergunta do lead não puder ser respondida com essas informações, seja honesto e ofereça encaminhar para um vendedor humano):
{base_conhecimento}

Escreva a próxima mensagem que a Base7 deve enviar para responder ao lead. Seja natural, direto,
breve (poucas frases) e no tom de uma conversa real de WhatsApp — sem saudações genéricas repetidas
se a conversa já estiver em andamento.

Responda APENAS com este JSON (sem texto fora do JSON):
{{"resposta":"texto da mensagem sugerida"}}"""


def gerar_resposta(lead_id):
    """Retorna (resposta_texto, erro, http_status). Nunca envia — só sugere (seção 34 do plano)."""
    lead = lead_service.obter_lead(lead_id)
    if not lead:
        return None, "Lead não encontrado", 404

    conversa = conversation_service.obter_conversa_por_lead(lead_id)
    if not conversa or not conversa.get("mensagens"):
        return None, "Esta conversa ainda não tem mensagens", 400

    prompt = _montar_prompt_resposta(lead, conversa)
    dados, erro, http_status = claude_client.perguntar_json(prompt, max_tokens=300)
    if erro:
        return None, erro, http_status

    resposta = (dados.get("resposta") or "").strip()
    if not resposta:
        return None, "A IA não retornou uma resposta válida", 500
    return resposta, None, 200
