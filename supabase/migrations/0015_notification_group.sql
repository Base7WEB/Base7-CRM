alter table public.admin_notification_settings
  add column notification_group_jid text;

comment on column public.admin_notification_settings.notification_group_jid is 'JID do grupo do WhatsApp (ex: 123456789-987654321@g.us) para onde alertas/resumos sao enviados. Sem isso configurado, o cron nao envia nada (fica so acumulando na fila). O numero conectado do admin precisa ser membro do grupo -- rode o wa-agent e confira o terminal: ele lista os grupos que participa (nome + JID) ao conectar.';
