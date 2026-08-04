# IA de Conversação — guia técnico

Como o Claude interpreta as mensagens recebidas no WhatsApp, o que ele pode e não pode fazer sozinho, e como isso é aplicado no CRM.

## Onde isso vive no código

```text
services/claude_client.py           # chamada genérica ao Claude, parse de JSON, tratamento de erro
services/ai_conversation_service.py # prompts de análise de intenção e de geração de resposta
services/action_engine.py           # decide o que fazer com o resultado da análise
services/knowledge_base_service.py  # base de conhecimento comercial usada na geração de resposta
```

Fluxo completo, do recebimento ao envio automático (quando permitido):

```text
WhatsApp → receiver.py detecta mensagem nova
        → conversation_service.processar_mensagem_recebida()
            → registra a mensagem, encontra ou cria o lead
            → ai_conversation_service.analisar_conversa()  (chamada ao Claude)
                → conversation_service.salvar_analise_ia()
                → action_engine.processar_analise()
                    → atualiza intencao_atual/temperatura/atencao_necessaria no lead
                    → cancela follow-ups pendentes de campanha para esse lead
                    → cria notificação, se a categoria exigir atenção humana
                    → decide (via config) se pode responder sozinho — se sim,
                      chama ai_conversation_service.gerar_resposta() e envia
```

A mesma análise também roda quando o usuário clica em "Analisar com IA" manualmente na Central de Conversas.

## Categorias de intenção

```text
interessado            quer_informacoes       pergunta_preco
quer_demonstracao       quer_reuniao           quer_contratar
negociacao              objecao_preco          objecao_tempo
nao_interessado          sem_resposta           pedir_contato_humano
reclamacao              fora_do_contexto
```

Cada análise retorna um JSON:

```json
{
  "intencao": "pergunta_preco",
  "temperatura": "quente",
  "score": 92,
  "urgencia": "alta",
  "objecao": null,
  "proxima_acao": "apresentar_preco",
  "confianca": 0.94
}
```

`temperatura` é sempre `quente`, `morno` ou `frio`. `proxima_acao` usa códigos curtos (`apresentar_sistema`, `apresentar_preco`, `agendar_reuniao`, `enviar_demo`, `responder_objecao`, `aguardar_resposta`, `encerrar_contato`, `chamar_vendedor`) que o CRM traduz para texto legível (`services/lead_service.py:ACOES_IA_TEXTO`) e prioriza sobre a sugestão determinística padrão.

A IA sempre recebe a conversa inteira disponível (últimas ~20 mensagens), não só a última — a intenção de "Quero contratar" só faz sentido lida em contexto.

## Três níveis de automação

Configurados em **Configurações → Automação de IA** (`config.json`, chave `ia_automacao_nivel`):

| Nível | O que acontece |
|---|---|
| `analise` (padrão) | Só classifica a intenção/temperatura e atualiza o lead. Nenhuma resposta é sugerida ou enviada. |
| `sugestao` | O usuário pode clicar em "Gerar resposta com IA" a qualquer momento; o texto vem editável no campo de mensagem. Nunca enviado sozinho. |
| `automatica` | Para categorias explicitamente liberadas (veja abaixo), a IA gera **e envia** a resposta sozinha, sem intervenção. |

No nível `automatica`, cada categoria tem um toggle próprio em Configurações:

```text
[ ] Perguntas simples       → quer_informacoes
[ ] Perguntas sobre preço   → pergunta_preco
[ ] Pedido de reunião       → quer_reuniao
```

## Escalonamento obrigatório (trava estrutural, não uma opção)

```python
CATEGORIAS_ESCALONAMENTO = {"quer_contratar", "negociacao", "reclamacao", "pedir_contato_humano"}
```

Essas quatro categorias **nunca** respondem automaticamente, em nenhum nível de automação. A tela de Configurações até mostra os toggles correspondentes (para transparência), mas eles ficam desabilitados e sem efeito — o código nem consulta essas chaves de configuração para decidir uma resposta automática (`action_engine.CATEGORIAS_TOGGLE_CONFIG` simplesmente não tem entrada para elas). Não existe combinação de configuração que contorne essa regra; é coberta por teste automatizado (`tests/test_action_engine.py`).

Quando uma dessas categorias é detectada, o CRM:
1. Marca o lead com `atencao_necessaria: true`.
2. Cria uma notificação interna (🔥 lead quente / ⚠️ atenção necessária) visível no sino do menu lateral.
3. Cancela follow-ups automáticos de campanha pendentes para aquele lead.
4. Nunca gera nem envia resposta sozinho — fica esperando um humano abrir a conversa.

## Base de conhecimento comercial

Cadastrada em **Configurações → Conhecimento comercial da Base7**: sobre a empresa, produtos, serviços, preços, diferenciais, FAQ, objeções e políticas comerciais. `knowledge_base_service.formatar_para_prompt()` concatena essas seções e injeta no prompt de geração de resposta com uma instrução explícita:

> "USE SOMENTE estas informações — nunca invente preço, prazo, funcionalidade ou condição que não esteja aqui; se a pergunta do lead não puder ser respondida com essas informações, seja honesto e ofereça encaminhar para um vendedor humano."

Sem nada cadastrado, a IA ainda funciona (analisa intenção normalmente), mas a geração de resposta fica sem contexto comercial — vale a pena preencher pelo menos "Sobre a empresa" e "Preços" antes de habilitar o nível `sugestao` ou `automatica`.

## Exemplo completo

```text
Lead: "Quero contratar, como fazemos?"

Claude → {"intencao": "quer_contratar", "temperatura": "quente",
          "urgencia": "alta", "proxima_acao": "chamar_vendedor", "confianca": 0.97}

Action Engine:
  → lead.intencao_atual = "quer_contratar"
  → lead.atencao_necessaria = true
  → follow-ups de campanha pendentes para esse lead: cancelados
  → notificação criada: "🔥 Empresa X quer contratar!"
  → resposta automática: NÃO (categoria de escalonamento)

CRM mostra no sino de notificações e na Central de Conversas:
  🔥 LEAD QUENTE — Empresa X quer contratar. [Abrir conversa]
```

Nenhuma mensagem é enviada sozinha nesse caso — um vendedor precisa abrir a conversa e responder (opcionalmente usando "Gerar resposta com IA" como ponto de partida editável).
