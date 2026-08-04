-- Fase 1: usuários (profiles) + RLS básica
-- profiles espelha auth.users com role/status usados por toda a aplicação.

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  full_name text not null,
  role text not null check (role in ('ADMIN', 'CONSULTOR_COMERCIAL')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Funções helper (security definer evita recursão de RLS ao consultar profiles
-- dentro das próprias policies de profiles).
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'ADMIN' and is_active = true
  );
$$;

create or replace function public.is_active_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and is_active = true
  );
$$;

create policy profiles_select on public.profiles
  for select using (is_active_user() and (id = auth.uid() or is_admin()));

create policy profiles_update on public.profiles
  for update using (id = auth.uid() or is_admin())
  with check (id = auth.uid() or is_admin());

-- Sem policy de insert/delete para 'authenticated': só o trigger de auth.users
-- (handle_new_user) e o backend com service role criam/removem perfis.

-- Impede que um consultor altere role/is_active da própria linha (RLS não
-- cobre granularidade de coluna; isso reforça o with check acima).
create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
as $$
begin
  if not is_admin() then
    if new.role <> old.role or new.is_active <> old.is_active then
      raise exception 'apenas admin pode alterar role/is_active';
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_protect_profile
  before update on public.profiles
  for each row execute function public.protect_profile_privileged_columns();

-- Cria o profile automaticamente ao criar um usuário no Supabase Auth.
-- role default é CONSULTOR_COMERCIAL; o admin cria usuários via service role
-- já passando role=ADMIN em raw_user_meta_data quando for o caso.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, role, is_active)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.email),
    coalesce(new.raw_user_meta_data->>'role', 'CONSULTOR_COMERCIAL'),
    true
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
