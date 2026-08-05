-- Tags simples no lead (mesma estrutura do CRM antigo: array de texto).
alter table public.leads add column tags text[] not null default '{}';

-- Tarefas por lead.
create table public.lead_tasks (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  texto text not null,
  prazo date,
  feita boolean not null default false,
  created_at timestamptz not null default now()
);

create index lead_tasks_lead_idx on public.lead_tasks(lead_id);

alter table public.lead_tasks enable row level security;

-- Mesmo dono do lead (ou admin) pode ler/criar/editar/apagar direto --
-- diferente de messages/lead_events, tarefas nao tem consequencia externa
-- (nao dispara envio de WhatsApp nem nada auditavel critico), entao nao
-- precisa passar por Route Handler com service role.
create policy lead_tasks_all on public.lead_tasks
  for all
  using (
    is_active_user()
    and lead_id in (select id from public.leads where responsavel_id = auth.uid() or is_admin())
  )
  with check (
    is_active_user()
    and lead_id in (select id from public.leads where responsavel_id = auth.uid() or is_admin())
  );

-- Central de Conversas: 1 linha por lead com a mensagem mais recente.
-- security_invoker = true -- a RLS de leads/messages aplica normalmente.
create view public.conversas_recentes
with (security_invoker = true) as
select distinct on (l.id)
  l.id as lead_id,
  l.empresa,
  l.telefone,
  l.responsavel_id,
  l.status,
  l.classificacao,
  m.body as ultima_mensagem,
  m.direction as ultima_direcao,
  m.created_at as ultima_mensagem_em
from public.leads l
join public.messages m on m.lead_id = l.id
order by l.id, m.created_at desc;
