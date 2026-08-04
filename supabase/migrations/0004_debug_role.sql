create or replace function public.debug_current_role()
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'current_user', current_user::text,
    'session_user', session_user::text,
    'auth_uid', auth.uid(),
    'auth_role', auth.role()
  );
$$;
