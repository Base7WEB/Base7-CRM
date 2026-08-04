-- Fase 2: leads + lead_events + audit_logs

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  empresa text not null,
  contato_nome text,
  telefone text not null,
  responsavel_id uuid references public.profiles(id),
  responsavel_legado_texto text,
  status text not null default 'NOVO' check (status in (
    'NOVO', 'CONTATO_REALIZADO', 'INTERAGINDO', 'QUALIFICADO',
    'REUNIAO_AGENDADA', 'PROPOSTA_ENVIADA', 'NEGOCIACAO',
    'GANHO', 'PERDIDO', 'SEM_INTERESSE', 'SEM_RESPOSTA'
  )),
  temperatura text check (temperatura in ('frio', 'morno', 'quente')),
  intencao_atual text,
  atencao_necessaria boolean not null default false,
  origem text not null default 'manual' check (origem in ('manual', 'scraper', 'campanha', 'whatsapp_inbound')),
  legacy_id text unique,
  last_interaction_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index leads_responsavel_idx on public.leads(responsavel_id);
create unique index leads_telefone_idx on public.leads(telefone);

alter table public.leads enable row level security;

create policy leads_select on public.leads
  for select using (is_active_user() and (is_admin() or responsavel_id = auth.uid()));

create policy leads_insert on public.leads
  for insert with check (is_active_user() and (is_admin() or responsavel_id = auth.uid()));

create policy leads_update on public.leads
  for update using (is_active_user() and (is_admin() or responsavel_id = auth.uid()))
  with check (is_active_user() and (is_admin() or responsavel_id = auth.uid()));

create policy leads_delete on public.leads
  for delete using (is_admin());

-- Reatribuição de responsável é sempre ato administrativo (auditado na app).
create or replace function public.protect_lead_responsavel()
returns trigger
language plpgsql
security definer
as $$
begin
  if not is_admin() and new.responsavel_id is distinct from old.responsavel_id then
    raise exception 'apenas admin pode reatribuir responsável do lead';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_protect_lead_responsavel
  before update on public.leads
  for each row execute function public.protect_lead_responsavel();

create table public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  type text not null check (type in (
    'FIRST_CONTACT_SENT', 'LEAD_REPLIED', 'CONVERSATION_STARTED',
    'FOLLOW_UP_SENT', 'FOLLOW_UP_RECEIVED', 'MEETING_SCHEDULED',
    'PROPOSAL_SENT', 'SALE_WON', 'LEAD_LOST', 'LEAD_INACTIVE',
    'HUMAN_ESCALATION_REQUIRED', 'WHATSAPP_CONNECTED', 'WHATSAPP_DISCONNECTED'
  )),
  actor_id uuid references public.profiles(id),
  whatsapp_message_id text,
  payload jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Idempotência: eventos ligados a 1 mensagem específica não duplicam se
-- a mensagem for reprocessada (insert ... on conflict do nothing).
create unique index lead_events_msg_idem_idx on public.lead_events(lead_id, type, whatsapp_message_id)
  where whatsapp_message_id is not null;

-- Idempotência: marcos únicos por lead, para sempre.
create unique index lead_events_singleton_idx on public.lead_events(lead_id, type)
  where type in ('FIRST_CONTACT_SENT', 'LEAD_REPLIED', 'CONVERSATION_STARTED', 'SALE_WON');

alter table public.lead_events enable row level security;

create policy lead_events_select on public.lead_events
  for select using (is_active_user() and (
    is_admin() or lead_id in (select id from public.leads where responsavel_id = auth.uid())
  ));
-- Sem policy de insert/update/delete para 'authenticated': só service role grava.

create table public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  action text not null,
  target_table text,
  target_id uuid,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

alter table public.audit_logs enable row level security;

create policy audit_logs_select on public.audit_logs
  for select using (is_admin());
-- Só service role insere (dentro dos Route Handlers de ação administrativa).
