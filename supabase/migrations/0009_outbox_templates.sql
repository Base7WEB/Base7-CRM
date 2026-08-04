-- Fase 5: fila de envio (outbox) + templates de mensagem.

create table public.outbox_messages (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id),
  lead_id uuid references public.leads(id),
  to_phone text not null,
  body text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
  attempt_count int not null default 0,
  whatsapp_message_id text,
  error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

create index outbox_pending_idx on public.outbox_messages(profile_id, status) where status = 'PENDING';

alter table public.outbox_messages enable row level security;

create policy outbox_select on public.outbox_messages
  for select using (is_active_user() and (is_admin() or profile_id = auth.uid()));
-- Insert: o proprio consultor (ou admin) pode enfileirar mensagem pra um
-- lead que ele é responsável (envio manual pela tela do CRM). Update/mais
-- inserts do agente sempre via service role.
create policy outbox_insert on public.outbox_messages
  for insert with check (
    is_active_user()
    and profile_id = auth.uid()
    and (lead_id is null or lead_id in (select id from public.leads where responsavel_id = auth.uid() or is_admin()))
  );

create table public.message_templates (
  id uuid primary key default gen_random_uuid(),
  stage text not null,
  title text not null,
  body text not null,
  created_at timestamptz not null default now()
);

alter table public.message_templates enable row level security;

create policy templates_select on public.message_templates
  for select using (is_active_user());
create policy templates_write on public.message_templates
  for all using (is_admin()) with check (is_admin());
