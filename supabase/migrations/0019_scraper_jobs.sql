-- Prospecção volta a existir dentro do CRM (era um menu de primeira classe
-- no projeto antigo). Playwright não roda na Vercel, então o padrão é o
-- mesmo já usado pro WhatsApp: o pedido de busca entra numa fila
-- (scraper_jobs), o agente local (apps/scraper em modo watch) consome via
-- polling autenticado por token, e os resultados voltam pra
-- scraper_job_leads pra revisão/seleção antes de virarem leads de verdade
-- -- só quem pediu a busca (ou o admin) decide o que importa.

create table public.scraper_jobs (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references public.profiles(id),
  modo text not null check (modo in ('maps', 'instagram')),
  params jsonb not null default '{}',
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'EM_ANDAMENTO', 'CONCLUIDO', 'ERRO')),
  erro text,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  finished_at timestamptz
);

create index scraper_jobs_pending_idx on public.scraper_jobs(requested_by, status) where status = 'PENDENTE';

alter table public.scraper_jobs enable row level security;

create policy scraper_jobs_select on public.scraper_jobs
  for select using (is_active_user() and (is_admin() or requested_by = auth.uid()));
-- Insert direto pelo próprio usuário (like o outbox de mensagem manual);
-- update/delete só via service role (agente e rota de import).
create policy scraper_jobs_insert on public.scraper_jobs
  for insert with check (is_active_user() and requested_by = auth.uid());

create table public.scraper_job_leads (
  id uuid primary key default gen_random_uuid(),
  job_id uuid not null references public.scraper_jobs(id) on delete cascade,
  empresa text not null,
  telefone text,
  endereco text,
  nicho text,
  cidade text,
  instagram text,
  site text,
  email text,
  rating_google numeric(2,1),
  reviews_google integer,
  importado boolean not null default false,
  lead_id uuid references public.leads(id),
  created_at timestamptz not null default now()
);

alter table public.scraper_job_leads enable row level security;

create policy scraper_job_leads_select on public.scraper_job_leads
  for select using (
    is_active_user() and job_id in (
      select id from public.scraper_jobs where is_admin() or requested_by = auth.uid()
    )
  );
-- Sem policy de insert/update para 'authenticated': resultados só chegam
-- via service role (agente reportando) ou rota de import (marca importado).

-- Campanhas: consultor passa a enxergar (não criar/iniciar/parar/excluir --
-- isso continua exclusivo do admin, via a policy "for all" já existente).
-- Postgres combina múltiplas policies permissivas com OR, então isso só
-- adiciona a permissão de leitura, sem afrouxar escrita.
create policy campaigns_select_active on public.campaigns
  for select using (is_active_user());

create policy campaign_followups_select_active on public.campaign_followups
  for select using (is_active_user());

-- Fila de uma campanha: consultor só vê as linhas dos próprios leads, não
-- a campanha inteira -- mesma regra de "só o que é seu" usada em leads.
create policy campaign_leads_select_own on public.campaign_leads
  for select using (
    is_active_user() and lead_id in (select id from public.leads where responsavel_id = auth.uid())
  );
