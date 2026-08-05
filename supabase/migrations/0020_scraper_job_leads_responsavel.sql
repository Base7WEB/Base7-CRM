-- Evita que um consultor fique tentando adivinhar por que um resultado deu
-- "duplicado" na hora de importar -- o backend já checa contra os leads
-- existentes (por telefone) assim que o scraper reporta o resultado, e
-- guarda de quem já é esse lead. Puramente informativo: quem decide se
-- pode importar continua sendo a constraint única de telefone em
-- public.leads, isso aqui só evita a surpresa.
alter table public.scraper_job_leads
  add column responsavel_atual text;
