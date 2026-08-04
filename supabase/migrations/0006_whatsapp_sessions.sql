-- Fase 3: infraestrutura do agente WhatsApp local (Baileys) por consultor/admin.
-- O agente local nunca fala com o Supabase diretamente -- só com Route
-- Handlers autenticados por token (hash aqui, nunca o token puro).

create table public.consultant_agent_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token_hash text not null,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create unique index cat_profile_active_idx on public.consultant_agent_tokens(profile_id) where revoked_at is null;
create unique index cat_token_hash_idx on public.consultant_agent_tokens(token_hash) where revoked_at is null;

alter table public.consultant_agent_tokens enable row level security;

create policy cat_select on public.consultant_agent_tokens
  for select using (is_admin());
-- Toda escrita (gerar/revogar token) via Route Handler admin-only com service role.

create table public.whatsapp_sessions (
  profile_id uuid primary key references public.profiles(id) on delete cascade,
  status text not null default 'DISCONNECTED' check (status in ('DISCONNECTED', 'QR_PENDING', 'CONNECTED')),
  last_connected_at timestamptz,
  last_disconnected_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.whatsapp_sessions enable row level security;

create policy wa_sessions_select on public.whatsapp_sessions
  for select using (is_active_user() and (is_admin() or profile_id = auth.uid()));
-- Update só via service role (heartbeat do agente).
