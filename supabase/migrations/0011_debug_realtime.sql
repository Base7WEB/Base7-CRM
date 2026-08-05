create or replace function public.debug_realtime_publication()
returns setof pg_publication_tables
language sql
stable
security definer
as $$
  select * from pg_publication_tables where pubname = 'supabase_realtime';
$$;
