-- Paridade com o wizard de campanhas do CRM antigo (campanhas.js +
-- campaign_service.py): metadados da campanha, seleção manual de leads
-- (já era assim desde 0016, aqui só ganham companhia de mais contexto),
-- follow-ups automáticos e limites/modos de envio.

alter table public.campaigns
  add column descricao text not null default '',
  add column nicho text,
  add column cidade text,
  add column tags text[] not null default '{}',
  add column limite_diario int not null default 80,
  add column limite_campanha int,
  add column modo_conservador boolean not null default false,
  add column modo_teste boolean not null default false;

-- outbox_messages.campaign_id não tinha regra de delete -- excluir uma
-- campanha finalizada/cancelada travava na FK se ela já tivesse gerado
-- mensagens de outbox. SET NULL preserva o histórico de mensagens já
-- enviadas, só desvincula da campanha apagada.
alter table public.outbox_messages
  drop constraint outbox_messages_campaign_id_fkey,
  add constraint outbox_messages_campaign_id_fkey
    foreign key (campaign_id) references public.campaigns(id) on delete set null;

alter table public.campaign_leads
  add column ultimo_envio_em timestamptz,
  add column followups_enviados int not null default 0,
  add column simulado boolean not null default false;

create table public.campaign_followups (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  ordem int not null default 0,
  dias int not null,
  texto text not null,
  created_at timestamptz not null default now()
);

alter table public.campaign_followups enable row level security;
create policy campaign_followups_all on public.campaign_followups for all using (is_admin()) with check (is_admin());

-- Templates prontos do CRM antigo (legacy/backend/data/templates.json) --
-- só semeia se a tabela ainda estiver vazia, pra não duplicar em reruns.
insert into public.message_templates (stage, title, body)
select * from (values
  ('Novo', 'Apresentação', 'Olá {empresa}! 👋 Vi o seu negócio e adorei. Sou especialista em [seu serviço] e acredito que posso agregar muito valor ao seu negócio. Podemos conversar 5 minutos?'),
  ('Novo', 'Curiosidade', 'Oi {empresa}, tudo bem? Estou entrando em contato porque tenho alguns clientes do mesmo segmento que você e os resultados têm sido incríveis. Posso te mostrar?'),
  ('Contato', 'Follow-up', 'Olá {empresa}! Fiz contato há alguns dias sobre [serviço]. Gostaria de saber se tiveram a oportunidade de pensar sobre isso. Posso ajudar com alguma informação?'),
  ('Contato', 'Reunião', 'Oi {empresa}! Que tal agendarmos uma reunião rápida de 20 minutos? Posso mostrar como empresas similares estão aumentando seus resultados.'),
  ('Reunião', 'Confirmação', 'Olá {empresa}! Passando para confirmar nossa reunião de amanhã. Vou preparar uma apresentação personalizada para o seu negócio. Até lá!'),
  ('Reunião', 'Pós-reunião', 'Foi um prazer conversar com você, {empresa}! Conforme combinado, vou preparar a proposta e te envio em breve. Qualquer dúvida, estou à disposição!'),
  ('Proposta', 'Envio', 'Olá {empresa}! Acabei de enviar a proposta por e-mail. Você conseguiu receber? Posso tirar alguma dúvida sobre os valores ou a proposta?'),
  ('Proposta', 'Follow-up', 'Oi {empresa}! Passando para verificar se puderam analisar a proposta. Há alguma objeção que eu possa ajudar a esclarecer?'),
  ('Negociação', 'Condições', 'Olá {empresa}! Para fecharmos, podemos ajustar as condições de pagamento conforme sua necessidade. O que seria mais conveniente para vocês?'),
  ('Negociação', 'Urgência', 'Oi {empresa}! Só para reforçar que essa condição especial é válida até [data]. Não quero que percam essa oportunidade!'),
  ('Cliente', 'Boas-vindas', 'Seja muito bem-vindo, {empresa}! 🎉 É um prazer ter vocês como clientes. Em breve entro em contato com os próximos passos do onboarding.'),
  ('Cliente', 'Indicação', 'Olá {empresa}! Espero que estejam satisfeitos com os resultados! Caso conheçam outros negócios que possam se beneficiar, ficaremos honrados com uma indicação.'),
  ('Perdido', 'Reativação', 'Olá {empresa}! Faz um tempo que não conversamos. Passando para ver se algo mudou e se posso ajudar de alguma forma agora.')
) as v(stage, title, body)
where not exists (select 1 from public.message_templates);
