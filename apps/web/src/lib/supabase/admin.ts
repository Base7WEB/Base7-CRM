import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

// Cliente com a service role key — bypassa RLS. Nunca importar este módulo
// em Client Components; "server-only" garante um erro de build se acontecer.
// Usar apenas depois de validar que quem chamou é ADMIN (ver requireAdmin em
// lib/auth.ts) — a service role key não faz essa checagem sozinha.
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}
