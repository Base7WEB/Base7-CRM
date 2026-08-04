-- Fase 4: historico de mensagens + deteccao automatica de eventos.

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  direction text not null check (direction in ('IN', 'OUT')),
  body text not null,
  whatsapp_message_id text not null,
  sent_by uuid references public.profiles(id),
  created_at timestamptz not null default now()
);

create unique index messages_wa_id_idx on public.messages(whatsapp_message_id);
create index messages_lead_idx on public.messages(lead_id, created_at);

alter table public.messages enable row level security;

create policy messages_select on public.messages
  for select using (is_active_user() and (
    is_admin() or lead_id in (select id from public.leads where responsavel_id = auth.uid())
  ));
-- Só service role insere (via /api/agent/whatsapp/inbound).
