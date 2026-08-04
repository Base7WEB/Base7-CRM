# wa-agent

Agente local do WhatsApp de cada consultor (ou do admin, para o canal de notificações). Roda na máquina de quem vai usar aquele número — nunca no servidor/Vercel, porque precisa manter uma sessão do WhatsApp viva.

## Como rodar

1. No CRM, como admin, vá em **Gerenciar consultores** e clique em **Gerar token WhatsApp** para o usuário dono deste número. Copie o token (só aparece uma vez).
2. Nesta pasta (`apps/wa-agent`), copie `.env.example` para `.env` e cole o token em `CRM_AGENT_TOKEN`. Ajuste `CRM_API_BASE_URL` se não for produção.
3. `npm install` (se ainda não rodou o install do monorepo inteiro).
4. `npm start`.
5. Um QR code aparece no terminal. Escaneie com o WhatsApp em **Aparelhos conectados**.

A sessão fica salva em `session-data/` (nesta mesma pasta) — enquanto esse diretório existir, não precisa escanear de novo, mesmo reiniciando o processo. **Fechar este terminal interrompe a automação do WhatsApp** — o resto do CRM (leads, dashboard, login) continua funcionando normalmente, só a detecção de mensagens desse número para.

Para trocar de número, apague a pasta `session-data/` e rode de novo (vai pedir um novo QR).

## Segurança

- O token de agente autentica a **máquina**, não um usuário — trate-o como uma senha. Se vazar, gere um novo pelo painel admin (isso revoga o anterior automaticamente).
- `session-data/` nunca deve ir para o Git (já está no `.gitignore` da raiz do monorepo).
