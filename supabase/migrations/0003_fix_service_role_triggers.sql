-- Bug: os triggers de protecao (before update) rodam para QUALQUER role,
-- inclusive service_role -- diferente de RLS, que e pulada automaticamente
-- para service_role. Como is_admin() depende de auth.uid() (nulo em
-- conexoes de service role), o backend com service role ficava bloqueado
-- de fazer as mesmas reatribuicoes/alteracoes administrativas que ele
-- mesmo deveria executar (ex: rota /api/admin/leads/[id]/assign).
-- Fix: liberar quando a role de sessao do Postgres for 'service_role'.

create or replace function public.protect_lead_responsavel()
returns trigger
language plpgsql
security definer
as $$
begin
  if current_user <> 'service_role' and not is_admin() and new.responsavel_id is distinct from old.responsavel_id then
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
  if current_user <> 'service_role' and not is_admin() then
    if new.role <> old.role or new.is_active <> old.is_active then
      raise exception 'apenas admin pode alterar role/is_active';
    end if;
  end if;
  new.updated_at = now();
  return new;
end;
$$;
