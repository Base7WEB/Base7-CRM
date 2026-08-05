-- Fase 8: campanhas em massa. Operacao centralizada pelo admin (mesma
-- decisao do CRM antigo: 1 campanha ativa por vez no sistema todo, RLS
-- admin-only em v1).

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  corpo_mensagem text not null,
  status text not null default 'RASCUNHO' check (status in ('RASCUNHO', 'EM_EXECUCAO', 'PAUSADA', 'FINALIZADA', 'CANCELADA')),
  intervalo_min_seg int not null default 30,
  intervalo_max_seg int not null default 90,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- so uma campanha em execucao por vez -- mesma limitacao estrutural do
-- sistema antigo (sessao/fila unica), agora expressa como constraint.
create unique index campaigns_uma_em_execucao_idx on public.campaigns((status = 'EM_EXECUCAO')) where status = 'EM_EXECUCAO';

alter table public.campaigns enable row level security;
create policy campaigns_all on public.campaigns for all using (is_admin()) with check (is_admin());

create table public.campaign_leads (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  lead_id uuid not null references public.leads(id) on delete cascade,
  status text not null default 'PENDENTE' check (status in ('PENDENTE', 'ENFILEIRADO', 'ENVIADO', 'FALHOU', 'PULADO')),
  outbox_message_id uuid references public.outbox_messages(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index campaign_leads_unicos_idx on public.campaign_leads(campaign_id, lead_id);

alter table public.campaign_leads enable row level security;
create policy campaign_leads_all on public.campaign_leads for all using (is_admin()) with check (is_admin());

-- outbox_messages ganha rastreamento de campanha + agendamento
-- (not_before): permite o admin disparar uma campanha inteira de uma vez
-- no backend, mas o AGENTE so envia cada mensagem no horario escalonado
-- calculado (nao dispara tudo de uma vez -- e o mecanismo real de
-- espacamento, nao so um numero de configuracao decorativo).
alter table public.outbox_messages
  add column campaign_id uuid references public.campaigns(id),
  add column not_before timestamptz;

create index outbox_pending_due_idx on public.outbox_messages(profile_id, not_before) where status = 'PENDING';
