-- Fase de notificações (parte 2): relatório semanal e mensal, além do
-- diário que já existia. O cron nativo da Vercel continua rodando só
-- 1x/dia (plano Hobby) -- semanal/mensal são checados dentro dessa MESMA
-- execução diária (é dia da semana configurado? é a regra do mês
-- configurada?), sem precisar de mais slots de cron.

alter table public.admin_notification_settings
  add column weekly_summary_weekday int not null default 5 check (weekly_summary_weekday between 0 and 6),
  add column weekly_summary_time time not null default '18:00',
  add column last_weekly_summary_sent_on date,
  add column monthly_summary_rule text not null default 'ultimo_dia' check (
    monthly_summary_rule in ('ultima_sexta', 'ultimo_sabado', 'ultimo_dia')
  ),
  add column monthly_summary_time time not null default '18:00',
  add column last_monthly_summary_sent_on date;

comment on column public.admin_notification_settings.weekly_summary_weekday is '0=domingo .. 6=sabado (default 5=sexta)';
