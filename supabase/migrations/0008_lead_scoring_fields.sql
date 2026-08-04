-- Fase 5 (ajustada): scoring deterministico de leads, sem IA/API externa.
-- A migracao original (0002) nao trouxe varios campos do scraper que
-- existiam no leads.json legado (nicho, cidade, instagram, site, email,
-- rating_google, reviews_google) -- sao justamente os dados que o scoring
-- objetivo precisa. Adicionando aqui + colunas de resultado do score.

alter table public.leads
  add column nicho text,
  add column cidade text,
  add column instagram text,
  add column site text,
  add column email text,
  add column rating_google numeric(2,1),
  add column reviews_google integer,
  add column score smallint not null default 0 check (score between 0 and 100),
  add column classificacao text not null default 'FRIO' check (classificacao in ('QUENTE', 'QUALIFICADO', 'MORNO', 'FRIO'));

comment on column public.leads.score is 'Score determinístico 0-100, calculado por lib/scoring (ver apps/web/src/lib/scoring) — nunca por IA/API externa nesta fase.';
comment on column public.leads.classificacao is 'Faixa derivada do score: QUENTE 80-100, QUALIFICADO 60-79, MORNO 40-59, FRIO 0-39.';
comment on column public.leads.temperatura is 'Reservado para uma futura camada de IA (nao usado pelo scoring determinístico) — mantido para nao exigir refatoracao quando/se essa camada existir.';
