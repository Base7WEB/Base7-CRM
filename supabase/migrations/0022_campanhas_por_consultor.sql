-- Campanha pode ser "geral" (responsavel_id null, qualquer consultor) ou
-- de um consultor especifico -- nesse caso a selecao de leads no wizard
-- fica travada aos leads dele.
alter table public.campaigns
  add column responsavel_id uuid references public.profiles(id);

-- Permite o admin prospectar "em nome de" um consultor especifico (o job
-- so eh processado pelo scraper local QUE TEM o token daquele consultor --
-- isso so muda de quem fica a fila, nao quem executa). Sem isso, o admin
-- só conseguia criar pedidos de busca atribuídos a si mesmo.
drop policy scraper_jobs_insert on public.scraper_jobs;
create policy scraper_jobs_insert on public.scraper_jobs
  for insert with check (is_active_user() and (requested_by = auth.uid() or is_admin()));
