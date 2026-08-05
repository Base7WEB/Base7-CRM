-- Fase 7: alertas e resumos automaticos para o WhatsApp do admin.

create table public.admin_alert_queue (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('SALE_WON', 'LEAD_HOT', 'WHATSAPP_DISCONNECTED')),
  payload jsonb not null default '{}',
  notified boolean not null default false,
  created_at timestamptz not null default now()
);

create index admin_alert_pending_idx on public.admin_alert_queue(notified) where notified = false;

alter table public.admin_alert_queue enable row level security;

create policy admin_alert_select on public.admin_alert_queue
  for select using (is_admin());
-- Insert só via service role (produtores de evento no código do app).

create table public.admin_notification_settings (
  id int primary key default 1 check (id = 1),
  digest_interval_minutes int not null default 120,
  daily_summary_time time not null default '18:00',
  last_digest_sent_at timestamptz,
  last_daily_summary_sent_on date,
  updated_at timestamptz not null default now()
);

insert into public.admin_notification_settings (id) values (1);

alter table public.admin_notification_settings enable row level security;

create policy admin_settings_select on public.admin_notification_settings
  for select using (is_admin());
create policy admin_settings_update on public.admin_notification_settings
  for update using (is_admin()) with check (is_admin());
