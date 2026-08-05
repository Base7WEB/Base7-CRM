-- Link direto pra ficha do lead no Google Maps -- guardado na hora do
-- scraping (a URL da pagina de detalhe visitada pelo Playwright), pra
-- facilitar conferencia manual sem precisar buscar o nome de novo.
alter table public.leads add column google_maps_url text;
alter table public.scraper_job_leads add column google_maps_url text;
