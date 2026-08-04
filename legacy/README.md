# BASE7 CRM PRO

Plataforma inteligente de prospecção e vendas B2B. Combina um pipeline de leads no estilo Kanban, um scraper que coleta estabelecimentos do Google Maps (e, de forma experimental, do Instagram), automação de campanhas de WhatsApp com fila e follow-ups, uma central de conversas com IA (Claude) interpretando cada resposta recebida, e relatórios de desempenho — tudo em um único CRM local.

```text
SCRAPER → LEADS → IA DE QUALIFICAÇÃO → CRM → CAMPANHAS → WHATSAPP →
CONVERSAS → IA DE INTERPRETAÇÃO → AÇÃO COMERCIAL → FOLLOW-UP → PIPELINE → CLIENTE
```

Aplicação local (roda na máquina do usuário), pensada para times pequenos ou uso individual de prospecção comercial.

---

## Visão geral

- **Backend**: Flask (Python) servindo uma API REST + os arquivos estáticos do frontend, organizado em `services/` (regras de negócio) e `routes/` (blueprints finos).
- **Frontend**: HTML/CSS/JS puro (sem framework/bundler), consumindo a API via `fetch`.
- **Persistência**: arquivos JSON em disco (`backend/data/`) — sem banco de dados.
- **Prospecção**: Playwright (Chromium headless) faz scraping do Google Maps para coletar empresas por nicho + cidade. Há também um scraper experimental de Instagram por hashtag.
- **WhatsApp**: uma sessão real do WhatsApp Web (Playwright, Chromium visível) permite enviar mensagens individuais, rodar campanhas em massa com fila e follow-ups automáticos, e receber respostas — tudo registrado numa Central de Conversas.
- **IA (Claude)**: analisa leads sob demanda, interpreta a intenção de cada mensagem recebida (pergunta de preço, interesse em contratar, reclamação etc.), sugere ou — se configurado — envia respostas automaticamente, sempre restrita a uma base de conhecimento comercial editável e sempre escalando para um humano em situações sensíveis.

---

## Stack técnica

| Camada     | Tecnologia |
|------------|------------|
| Backend    | Python 3, Flask, Flask-CORS |
| Scraping / WhatsApp | Playwright (Chromium) + playwright-stealth |
| IA         | SDK `anthropic` (modelo `claude-haiku-4-5`) |
| Importação | `openpyxl` (leitura de planilhas XLSX) |
| Frontend   | HTML5, CSS3, JavaScript (vanilla, módulos IIFE) |
| Gráficos   | Chart.js (via CDN) |
| Testes     | `pytest` (backend) |
| Dados      | Arquivos JSON (`backend/data/*.json`) |

Não há build step, transpilação ou dependências de frontend via npm — o `frontend/` é servido como estático diretamente pelo Flask.

---

## Estrutura de pastas

```text
crmbase7 - Copia/
├── start.bat                  # script de inicialização (Windows)
├── logo.png
├── base72.html                 # protótipo antigo standalone (não usado pela app)
├── Untitled-1.html             # protótipo antigo standalone (não usado pela app)
├── docs/
│   ├── WHATSAPP.md             # conexão, sessão, limites, troubleshooting
│   └── CONVERSATION_AI.md      # intenções, níveis de automação, escalonamento, prompts
├── backend/
│   ├── app.py                  # registra blueprints; rotas legadas (leads/meta/config/relatório)
│   ├── scraper.py              # scraping Google Maps / Instagram via Playwright
│   ├── requirements.txt
│   ├── pytest.ini
│   ├── whatsapp/                # camada isolada de automação do WhatsApp Web
│   │   ├── loop.py              # event loop asyncio persistente em thread própria
│   │   ├── session.py           # sessão persistente do Chromium (login não expira)
│   │   ├── manager.py           # WhatsAppManager: connect/disconnect/status/qr/envio
│   │   ├── sender.py            # navegação + envio de mensagens
│   │   ├── receiver.py          # polling da lista de conversas por mensagens novas
│   │   └── utils.py             # normalizar_telefone(), delay/jitter
│   ├── services/                # regra de negócio (a camada que a maioria das rotas delega)
│   │   ├── lead_service.py          # CRUD de leads, score, próxima ação, importação/dedup
│   │   ├── config_service.py        # config.json (chave IA, agendamento, automação)
│   │   ├── template_service.py      # templates de WhatsApp por etapa do pipeline
│   │   ├── import_service.py        # parsing de CSV/XLSX/TXT + sugestão de mapeamento
│   │   ├── campaign_service.py      # CRUD e transições de estado de campanhas
│   │   ├── campaign_worker.py       # worker de fila (envios + follow-ups automáticos)
│   │   ├── conversation_service.py  # histórico de conversas, recebimento de mensagens
│   │   ├── whatsapp_service.py      # fachada síncrona sobre o WhatsAppManager
│   │   ├── claude_client.py         # helper compartilhado para chamadas à API do Claude
│   │   ├── ai_conversation_service.py # análise de intenção + geração de resposta
│   │   ├── knowledge_base_service.py  # base de conhecimento comercial (usada pela IA)
│   │   ├── action_engine.py         # orquestra consequências de cada análise de IA
│   │   ├── notification_service.py  # notificações internas (lead quente, campanha etc.)
│   │   └── analytics_service.py     # métricas do dashboard WhatsApp e relatórios
│   ├── routes/                  # blueprints Flask finos (delegam para services/)
│   ├── data/                    # gerado em runtime — ver "Modelos de dados" abaixo
│   │   └── whatsapp_session/    # perfil persistente do Chromium (login do WhatsApp)
│   └── tests/                   # suíte pytest (services isolados via tmp_path/monkeypatch)
└── frontend/
    ├── index.html               # SPA com as 7 views (dashboard, pipeline, leads, prospecção, whatsapp, relatórios, config)
    ├── css/style.css
    └── js/
        ├── api.js               # wrapper fetch para a API
        ├── app.js               # bootstrap, navegação entre views, Configurações
        ├── crm.js               # CRUD de leads, modal, tags, tasks, IA de lead
        ├── pipeline.js          # Kanban (drag & drop) por estágio
        ├── prospeccao.js        # UI de scraping (Google Maps / Instagram)
        ├── relatorios.js        # gráficos e relatório semanal
        ├── whatsapp.js          # conexão/QR do módulo WhatsApp
        ├── whatsapp_dashboard.js # métricas do dia, campanha ativa, leads quentes
        ├── campanhas.js         # wizard de campanha, fila, controles
        ├── conversas.js         # Central de Conversas (inbox) + botões de IA
        ├── importar.js          # importação de arquivo com preview e mapeamento
        ├── notificacoes.js      # sino de notificações no sidebar
        └── icons.js             # ícones inline SVG
```

> `base72.html` e `Untitled-1.html` são versões antigas/protótipo que antecederam a separação atual em backend/frontend. Não são carregados pela aplicação em execução.

---

## Funcionalidades

### 1. Dashboard
Funil de vendas por status, follow-ups do dia, leads recentes, distribuição por origem, progresso da meta mensal.

### 2. Pipeline (Kanban)
Drag & drop entre estágios (`Novo → Contato → Reunião → Proposta → Negociação → Cliente / Perdido`), valor total por coluna, indicador de tempo parado na etapa.

### 3. Leads
Tabela com filtros, ordenação, busca, edição em modal (contato, tags, tarefas, histórico), exportação CSV, envio de WhatsApp (manual via `wa.me` ou automático quando conectado) e análise por IA sob demanda.

### 4. Prospecção
Google Maps (nicho + cidades, raio, nota mínima, enriquecimento de e-mail) e Instagram (hashtag, experimental), com agendamento semanal automático.

### 5. WhatsApp
Novo módulo completo de automação comercial, dividido em 4 painéis:

- **Conexão** — tela de QR Code para conectar uma sessão real do WhatsApp Web (Playwright); status em tempo real (desconectado / aguardando QR / conectado), sessão persiste entre reinícios do backend.
- **Dashboard** — mensagens do dia, leads contatados, respostas, interessados, taxa de resposta, campanha ativa com barra de progresso, lista de leads quentes, e tabelas comparando desempenho por template e por nicho.
- **Campanhas** — wizard de 6 passos (detalhes → seleção de leads com filtros → mensagem com preview de variáveis → follow-ups → limites/intervalos/modo teste → revisão). Fila com envio serializado (nunca dois envios simultâneos), intervalos aleatórios configuráveis, modo conservador, limite diário/por campanha, e controles iniciar/pausar/retomar/parar/pular por lead. **Modo teste** simula toda a fila sem enviar nada de verdade.
- **Conversas** — inbox de duas colunas com todas as conversas, envio manual, e os dois níveis de IA (`Analisar com IA` e `Gerar resposta com IA`).

Follow-ups automáticos: cada campanha pode ter uma sequência de mensagens de reforço (ex.: "após 3 dias sem resposta"), canceladas automaticamente assim que o lead responde ou sai do status "Novo".

### 6. Inteligência de conversas (IA)
Quando uma mensagem chega (ou quando o usuário clica em "Analisar"), o Claude interpreta a conversa inteira (não só a última mensagem) e classifica a intenção em uma de 14 categorias (`pergunta_preco`, `quer_contratar`, `reclamacao`, `nao_interessado` etc.), com temperatura (🔥 quente / 🟡 morno / 🔵 frio), urgência e confiança. Três níveis de automação, configuráveis em **Configurações → Automação de IA**:

1. **Apenas analisar** (padrão) — só classifica e atualiza o lead.
2. **Analisar + sugerir** — a IA pode gerar uma resposta sugerida (botão "Gerar resposta com IA"), sempre editável antes de enviar, nunca enviada sozinha.
3. **Responder automaticamente** — para categorias explicitamente liberadas (perguntas simples, preço, pedido de reunião), a IA gera e envia a resposta sozinha.

Categorias sensíveis (`quer_contratar`, `negociacao`, `reclamacao`, `pedir_contato_humano`) **nunca** respondem automaticamente, mesmo no nível 3 — essa trava é estrutural no código (`services/action_engine.py`), não apenas uma opção desligável. Veja `docs/CONVERSATION_AI.md` para detalhes.

A IA de resposta só usa o conteúdo cadastrado em **Configurações → Conhecimento comercial da Base7** (sobre a empresa, produtos, preços, FAQ, objeções, políticas) — nunca inventa preço, prazo ou condição.

### 7. Relatórios
Gráficos de leads por status/mês/valor, follow-ups da semana, relatório semanal copiável em texto.

### 8. Configurações
Scraper, meta mensal, chave da IA, agendamento de prospecção, templates de WhatsApp por etapa, automação de IA, base de conhecimento comercial, backup/restore.

### Importação de leads
Upload de **CSV, XLSX ou TXT** (lista de telefones, um por linha, com ou sem `Nome | Telefone`) com preview, mapeamento de colunas e deduplicação — primeiro por telefone normalizado, depois por nome + cidade.

### Notificações internas
Sino no menu lateral com contador de não lidas: leads quentes, campanhas finalizadas, situações que exigem atenção humana. Clique leva direto à conversa.

### Scoring automático de leads
`calcular_score`: site (+25), telefone (+20), Instagram (+15), valor > R$ 3.000 (+20), follow-up agendado (+10), nota Google ≥ 4.0 (+10), mais de 50 avaliações (+10) — limitado a 100.

### Sugestão de próxima ação
`sugerir_proxima_acao` prioriza a última análise de IA da conversa quando existe (ex.: *"🔥 Atenção: chamar um vendedor humano (sugestão da IA)"*); sem isso, cai para a regra determinística por status + dias sem atividade + follow-up vencido.

---

## API (backend/app.py + routes/)

Base: `http://localhost:5000/api`

### Leads, meta, config, relatórios (`app.py`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/status` | Healthcheck (IA e WhatsApp disponíveis) |
| GET/POST/PUT/DELETE | `/leads`, `/leads/<id>` | CRUD de leads |
| GET/POST | `/meta` | Meta mensal de faturamento |
| GET/POST | `/config` | Configurações gerais (IA, agendamento, automação) |
| POST | `/ia/analisar` | Analisa um lead (score/insight) |
| POST | `/ia/analisar-mensagem`, `/ia/gerar-resposta` | Atalhos para os endpoints de conversa abaixo |
| GET | `/relatorio-semanal` | Estatísticas da semana |
| POST | `/pesquisar`, `/pesquisar-instagram` | Scraping (assíncrono) |
| GET | `/pesquisar/status` | Progresso do scraping |
| POST | `/importar` | Importa leads já mapeados (com dedup) |
| GET/POST | `/backup`, `/restore` | Exporta/restaura todos os leads |

### Templates, importação de arquivo, base de conhecimento
| Método | Rota | Descrição |
|---|---|---|
| GET/POST | `/templates` | Templates de WhatsApp por etapa do pipeline |
| POST | `/importar/preview` | Upload CSV/XLSX/TXT → preview + mapeamento sugerido |
| GET/POST | `/knowledge-base` | Base de conhecimento comercial usada pela IA |
| GET | `/notifications` | Lista notificações |
| POST | `/notifications/<id>/read`, `/notifications/read-all` | Marca como lida(s) |

### WhatsApp (`routes/whatsapp_routes.py`)
| Método | Rota | Descrição |
|---|---|---|
| GET/POST | `/whatsapp/status`, `/connect`, `/disconnect` | Ciclo de vida da sessão |
| GET | `/whatsapp/qr` | QR Code atual (base64) |
| POST | `/whatsapp/send` | Envia mensagem a um lead |
| POST | `/whatsapp/check-number` | Verifica se um número existe no WhatsApp |
| GET | `/whatsapp/dashboard` | Métricas do painel Dashboard |

### Campanhas (`routes/campaign_routes.py`)
| Método | Rota | Descrição |
|---|---|---|
| GET/POST | `/campaigns` | Lista / cria campanha |
| GET/PUT/DELETE | `/campaigns/<id>` | Detalhe / atualiza / remove |
| POST | `/campaigns/<id>/start\|pause\|resume\|stop` | Controle de execução |
| GET | `/campaigns/<id>/queue` | Fila da campanha |
| POST | `/campaigns/<id>/queue/<lead_id>/skip` | Pula um lead da fila |

### Conversas (`routes/conversation_routes.py`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/conversations` | Lista todas as conversas (com dados do lead) |
| GET | `/conversations/<lead_id>` | Lead + conversa completa |
| POST | `/conversations/<lead_id>/send` | Envio manual dentro da conversa |
| POST | `/conversations/<lead_id>/analyze` | Análise de intenção pela IA |
| POST | `/conversations/<lead_id>/generate-response` | Gera (sem enviar) uma resposta sugerida |

### Analytics (`routes/analytics_routes.py`)
| Método | Rota | Descrição |
|---|---|---|
| GET | `/analytics/geral` | Funil de conversas (taxas de resposta/interesse/conversão) |
| GET | `/analytics/por-template` | Desempenho comparado entre templates |
| GET | `/analytics/por-nicho` | Desempenho comparado entre nichos |

---

## Modelos de dados

### Lead (`backend/data/leads.json`)
```json
{
  "id": "uuid",
  "empresa": "string",
  "responsavel": "string",
  "nicho": "string",
  "cidade": "string",
  "telefone": "string",
  "telefone_normalizado": "5511999998888",
  "instagram": "string",
  "site": "string",
  "email": "string",
  "valor": 0,
  "origem": "Manual | Google Maps | Instagram | Importação | WhatsApp",
  "status": "Novo | Contato | Reunião | Proposta | Negociação | Cliente | Perdido",
  "rating_google": 0,
  "reviews_google": 0,
  "followup": "YYYY-MM-DD",
  "tags": [],
  "tasks": [],
  "historico": [{ "data": "iso", "acao": "string" }],
  "score": 0,
  "intencao_atual": "pergunta_preco | quer_contratar | ... | null",
  "temperatura": "quente | morno | frio | null",
  "ultima_analise_ia": { "intencao": "...", "temperatura": "...", "proxima_acao": "...", "confianca": 0.9 },
  "atencao_necessaria": false
}
```

### Conversation (`backend/data/conversations.json`)
```json
{
  "id": "uuid", "lead_id": "uuid", "telefone": "5511999998888",
  "mensagens": [{ "id": "uuid", "data": "iso", "direcao": "enviada | recebida", "texto": "string", "campanha_id": "uuid" }],
  "ultima_analise_ia": { }
}
```

### Campaign (`backend/data/campaigns.json`)
```json
{
  "id": "uuid", "nome": "string", "leads": ["uuid"],
  "template": { "nome": "string", "texto": "string" },
  "followups": [{ "dias": 3, "texto": "string" }],
  "configuracoes": { "intervalo_min_seg": 20, "intervalo_max_seg": 60, "limite_diario": 80, "limite_campanha": 0, "modo_conservador": false, "modo_teste": false },
  "status": "Rascunho | Agendada | Em execução | Pausada | Finalizada | Cancelada",
  "metricas": { "enviadas": 0, "respostas": 0, "interessados": 0, "reunioes": 0, "propostas": 0, "clientes": 0 },
  "fila": [{ "lead_id": "uuid", "status": "pendente | enviado | erro | pulado", "tentativas": 0, "followups_enviados": 0, "erro": null }]
}
```

Outros arquivos: `templates.json` (por etapa do pipeline), `knowledge_base.json` (sobre/produtos/preços/FAQ/objeções/políticas), `notifications.json`, `meta.json`, `config.json`.

---

## Como rodar (Windows)

Pré-requisito: Python 3 instalado e no PATH.

1. Dê duplo clique em `start.bat` (ou execute-o via terminal).
2. O script instala as dependências, o Chromium do Playwright, e sobe o backend em `http://localhost:5000` (que também serve o frontend).
3. Mantenha a janela do terminal aberta — é o servidor rodando.

### Rodando manualmente

```bash
cd backend
pip install -r requirements.txt
python -m playwright install chromium
python app.py
```

### Conectando o WhatsApp
Acesse a aba **WhatsApp → Conexão**, clique em "Conectar WhatsApp" e escaneie o QR Code pelo celular. Veja `docs/WHATSAPP.md` para o requisito operacional (o Chromium abre uma janela visível — não roda em segundo plano headless) e dicas de reconexão.

### Configurar a IA (opcional)
Em **Configurações → IA**, informe a chave de API da Anthropic (ou defina a variável de ambiente `ANTHROPIC_API_KEY`). Sem isso, os recursos de IA ficam indisponíveis, mas o resto do CRM funciona normalmente.

### Rodando os testes

```bash
cd backend
python -m pytest tests -q
```

Os testes isolam completamente os dados reais (usam diretórios temporários) e mockam qualquer chamada real à API do Claude ou ao WhatsApp — nenhum teste depende de credenciais ou de uma sessão conectada.

---

## Avisos importantes

- **Persistência simples**: dados em JSON local, sem backup automático em nuvem. Use `/api/backup` e `/api/restore` periodicamente.
- **Scraping do Google Maps/Instagram e automação do WhatsApp Web** dependem da estrutura HTML dessas páginas, que pode mudar e quebrar seletores a qualquer momento. Use com moderação — scraping e automação desses serviços podem estar sujeitos aos Termos de Uso das respectivas plataformas; o uso é de responsabilidade de quem executa a ferramenta. Não há (nem deve haver) bypass de CAPTCHA ou de bloqueios anti-abuso — apenas intervalos, "modo conservador" e limites diários configuráveis.
- **A janela do Chromium do WhatsApp precisa ficar aberta** enquanto a automação estiver em uso — sessões headless do WhatsApp Web são detectadas e desconectadas com frequência.
- **Chave de API da IA**: salva em texto simples em `backend/data/config.json` (com fallback para a variável de ambiente `ANTHROPIC_API_KEY`); o endpoint de leitura mascara a chave na resposta, mas o arquivo local não é criptografado.
- **A IA nunca inventa condições comerciais**: respostas geradas usam exclusivamente o conteúdo de Configurações → Conhecimento comercial. Situações sensíveis (fechamento, negociação, reclamação, pedido de humano) sempre escalam para uma pessoa, mesmo com a automação no nível mais alto.
- **Uso local/single-user**: não há autenticação, controle de acesso ou multiusuário — a aplicação foi feita para rodar na máquina de quem a usa.

---

## Documentação adicional

- [`docs/WHATSAPP.md`](docs/WHATSAPP.md) — fluxo de conexão, persistência de sessão, limites de envio e troubleshooting.
- [`docs/CONVERSATION_AI.md`](docs/CONVERSATION_AI.md) — categorias de intenção, níveis de automação, regras de escalonamento, base de conhecimento e exemplos de prompt.
