-- Fase 6: leads sem acompanhamento, derivado de dados reais (ultima
-- mensagem por lead), nao de campo declarado manualmente.
--
-- security_invoker = true (suportado desde Postgres 15, este projeto usa
-- 17): a view roda com as permissoes de quem consulta, entao a RLS de
-- leads/messages aplica normalmente -- consultor ve so os proprios leads
-- parados, admin ve todos, sem precisar duplicar a logica de RLS aqui.
create view public.leads_parados
with (security_invoker = true) as
select
  l.id as lead_id,
  l.empresa,
  l.responsavel_id,
  l.status,
  lm.direction as ultima_direcao,
  lm.created_at as ultima_mensagem_em,
  case
    when lm.direction = 'IN' then 'aguardando_resposta_consultor'
    else 'sem_resposta_do_lead'
  end as motivo
from public.leads l
join lateral (
  select direction, created_at
  from public.messages m
  where m.lead_id = l.id
  order by m.created_at desc
  limit 1
) lm on true
where l.status not in ('GANHO', 'PERDIDO', 'SEM_INTERESSE')
  and (
    (lm.direction = 'IN' and lm.created_at < now() - interval '24 hours')
    or (lm.direction = 'OUT' and lm.created_at < now() - interval '48 hours')
  );
