-- current_user dentro de uma funcao SECURITY DEFINER reflete o DONO da
-- funcao, nao quem chamou -- por isso a checagem "current_user =
-- 'service_role'" da migration 0003 nunca era verdadeira (confirmado via
-- debug_current_role: current_user vinha como o owner da funcao, mas
-- auth.role() corretamente reportava 'service_role'). auth.role() le um
-- parametro de sessao (request.jwt.claim.role) setado pelo PostgREST por
-- requisicao, entao nao e afetado pela troca de usuario do SECURITY
-- DEFINER -- e o jeito correto de detectar a role de quem chamou.

create or replace function public.protect_lead_responsavel()
returns trigger
language plpgsql
security definer
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not is_admin() and new.responsavel_id is distinct from old.responsavel_id then
    raise exception 'apenas admin pode reatribuir responsável do lead';
  end if;
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.protect_profile_privileged_columns()
returns trigger
language plpgsql
security definer
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' and not is_admin() then
    if new.role <> old.role or new.is_active <> old.is_active then
      raise exception 'apenas admin pode alterar role/is_active';
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;

drop function if exists public.debug_current_role();
