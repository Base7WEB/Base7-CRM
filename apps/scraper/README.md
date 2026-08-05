# scraper

Coleta leads do Google Maps (e, experimentalmente, do Instagram) via Playwright e manda pro BASE7 CRM. Roda sob demanda, local — não fica ligado o tempo todo como o `wa-agent`, e não roda na Vercel (Playwright não cabe bem em serverless).

A lógica de scraping em si (`scraper.py`) é a mesma do CRM antigo (`legacy/backend/scraper.py`), só o destino mudou: em vez de gravar num JSON local, os leads coletados são enviados pro Supabase via `POST /api/agent/scraper/leads`.

## Como rodar

1. No CRM, como admin, gere um token de agente (mesma tela de **Gerenciar consultores** usada pro WhatsApp — o token de scraper usa o mesmo mecanismo). Os leads coletados ficam atribuídos ao dono desse token como responsável inicial (o admin pode reatribuir depois).
2. Dê dois cliques em **`instalar.bat`** (só na primeira vez, ou se der algum erro de dependência) — ele cria o ambiente virtual, instala tudo e já cria o `.env` a partir do exemplo. Abra o `.env` criado e cole o token do CRM.
3. Pra cada busca, dê dois cliques em **`buscar-leads.bat`** — ele pergunta nicho/cidade (ou hashtag, se escolher Instagram) direto na janela, sem precisar digitar comando nenhum.

Sem os `.bat` (Mac/Linux ou preferência por linha de comando):
1. `python -m venv venv && venv\Scripts\activate` (Windows) — ou seu gerenciador de ambiente Python preferido.
2. `pip install -r requirements.txt`
3. `python -m playwright install chromium`
4. Rodar uma busca:
   ```
   python run.py maps --nicho "Barbearia" --cidade "Campinas, SP" --rating-min 4 --max-resultados 30
   ```
   ou, experimental:
   ```
   python run.py instagram --hashtag barbeariacampinas --max-resultados 20
   ```

## O que é enviado

Cada lead coletado (empresa, nicho, cidade, endereço, telefone, instagram, site, e-mail, avaliação e quantidade de avaliações do Google) é normalizado e inserido no CRM. Telefones inválidos ou duplicados (empresa que já existe no CRM) são reportados e pulados — nunca duplicam um lead existente. O score/classificação de cada lead novo é calculado automaticamente na criação, do mesmo jeito que qualquer outro lead do sistema.

## Aviso

O scraping do Google Maps pode ser afetado por mudanças de layout do próprio Google (os seletores CSS podem parar de funcionar sem aviso — é normal precisar ajustar de tempos em tempos). O scraping de Instagram é experimental e limitado: o Instagram exige login pra maioria dos conteúdos, então funciona só em cenários bem específicos.
