# Módulo WhatsApp — guia técnico e operacional

O BASE7 CRM PRO automatiza o WhatsApp Web usando Playwright — não é a API oficial do WhatsApp Business, é uma sessão real do WhatsApp Web controlada por um navegador Chromium. Este documento explica como a conexão funciona, o que esperar operacionalmente, e como diagnosticar problemas.

## Arquitetura

```text
backend/whatsapp/
├── loop.py       # event loop asyncio de longa duração, em thread própria
├── session.py    # abre o Chromium com perfil persistente
├── manager.py    # WhatsAppManager: única porta de entrada para tudo isso
├── sender.py     # navegação para o deep-link do chat + envio de texto
├── receiver.py   # polling periódico da lista de conversas por mensagens novas
└── utils.py      # normalizar_telefone(), delay/jitter
```

Toda interação com seletores do WhatsApp Web fica dentro deste pacote. O resto do CRM (`services/whatsapp_service.py` e para cima) só conhece `WhatsAppManager` — se um dia o WhatsApp Web mudar de estrutura, ou a automação for trocada pela API oficial do WhatsApp Business, só este pacote precisa mudar.

### Por que uma thread com event loop próprio?
O scraper de prospecção (`scraper.py`) usa `asyncio.run()` descartável a cada chamada — cada busca é isolada e termina. O WhatsApp precisa de uma sessão **viva entre requisições HTTP**: conectar uma vez, manter o navegador aberto, e atender múltiplas chamadas (enviar, verificar número, receber) ao longo de horas. Por isso o `WhatsAppManager` roda um event loop persistente numa thread de fundo (`loop.py`), e as rotas Flask (síncronas) agendam corrotinas nele.

### Por que a janela do Chromium fica visível?
O WhatsApp Web tem detecção agressiva de automação headless — sessões headless são desconectadas com frequência, mesmo com `playwright-stealth`. Por isso a conexão roda com `headless=False`: **a máquina que hospeda o CRM precisa ficar ligada, com essa janela do Chromium aberta**, enquanto a automação estiver em uso. Ela pode ficar minimizada, mas não pode ser fechada nem rodar numa sessão sem interface gráfica.

### Persistência de sessão
O login fica salvo em `backend/data/whatsapp_session/` (perfil persistente do Chromium via `launch_persistent_context`). Reiniciar o backend **não** exige escanear o QR Code de novo, desde que essa pasta não seja apagada. Ela nunca entra em backups exportados pelo CRM (contém dados de sessão sensíveis).

## Fluxo de conexão

1. Usuário clica em "Conectar WhatsApp" na aba **WhatsApp → Conexão**.
2. O backend abre o Chromium e navega para `web.whatsapp.com`.
3. Enquanto não detecta uma sessão logada, tira screenshots periódicos do `<canvas>` do QR Code e os expõe via `GET /api/whatsapp/qr` (base64).
4. O frontend faz polling de `GET /api/whatsapp/status` a cada poucos segundos, atualizando a tela conforme o status muda: `desconectado → conectando → aguardando_qr → conectado` (ou `erro`).
5. Uma vez conectado, duas tarefas de fundo começam a rodar automaticamente:
   - **Monitor** (`_loop_monitor`): a cada 15s verifica se a sessão ainda está logada; se cair, o status volta para `desconectado` e qualquer campanha em execução é pausada automaticamente no próximo tick do worker.
   - **Receiver** (`_loop_receiver`): a cada 6–9s (com variação aleatória) varre a lista de conversas por indicadores de mensagem não lida e processa as novas.

## Envio de mensagens

Todo envio (individual, de campanha, ou resposta automática da IA) passa pelo mesmo caminho: `WhatsAppManager.enviar_mensagem()` → `sender.py`, que navega para `https://web.whatsapp.com/send?phone=<numero>&text=<mensagem>` e confirma o envio. Um `asyncio.Lock` interno garante que **nunca duas navegações acontecem ao mesmo tempo na mesma sessão** — envio individual, fila de campanha, verificação de número e o monitor de conexão disputam o mesmo lock.

## Limites e "modo conservador"

Cada campanha define, no passo 5 do wizard:

- **Intervalo mínimo/máximo (segundos)** entre envios — um valor aleatório dentro dessa faixa é usado a cada mensagem, para não parecer um robô disparando em ritmo constante.
- **Limite diário** — a campanha para de consumir a fila ao atingir esse número de envios no dia corrente (não é um erro, ela retoma sozinha no dia seguinte).
- **Limite da campanha** — teto total de envios para aquela campanha específica.
- **Modo conservador** — dobra os intervalos mínimo e máximo.
- **Modo teste** — simula toda a fila (avança status, valida telefone, registra `"simulado": true`) sem navegar até o WhatsApp real. Use para validar uma campanha nova sem gastar créditos de confiança da sua conta.

Não há, e não deve haver, qualquer mecanismo de bypass de CAPTCHA ou de bloqueios anti-abuso do WhatsApp — os limites acima são a única forma de reduzir risco de bloqueio, e o uso da automação é de responsabilidade de quem a executa.

## Troubleshooting

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| QR Code não aparece | Seletor do canvas mudou no WhatsApp Web | Veja `backend/whatsapp/session.py` (`SELETORES_QR`) — pode precisar de um seletor novo |
| Conecta e desconecta sozinho | Rodando headless, ou a janela do Chromium foi fechada | Confirme `headless=False` em `session.py` e que a janela segue aberta |
| Envio "trava" sem erro | Seletor da caixa de texto ou botão de enviar mudou | Veja `backend/whatsapp/sender.py` (`SELETORES_CAIXA_TEXTO`, `SELETORES_BOTAO_ENVIAR`) |
| Mensagens recebidas não aparecem | Seletor da lista de conversas mudou, ou nenhuma tem indicador de "não lida" no momento do polling | Veja `backend/whatsapp/receiver.py`; o polling só processa chats com indicador de não lida no instante do ciclo |
| Campanha travou em "Pausada" sozinha | WhatsApp caiu no meio da execução | Reconecte na aba Conexão e clique em "Retomar" na campanha |
| "Já existe uma campanha em execução" | O CRM permite só uma campanha ativa por vez, de propósito (fila única por sessão) | Pause ou finalize a campanha ativa antes de iniciar outra |

Como o WhatsApp Web muda de estrutura HTML com frequência, todos os seletores no pacote `whatsapp/` seguem o mesmo padrão de fallback do `scraper.py`: uma lista de candidatos tentados em ordem, não um seletor único e rígido.
