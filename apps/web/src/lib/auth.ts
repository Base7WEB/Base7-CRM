import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export async function getCurrentProfile(): Promise<Profile | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return profile;
}

// Usar em toda rota administrativa (páginas e Route Handlers). Nunca confiar
// em role vindo do client — isso sempre revalida contra o banco no servidor.
export async function requireAdmin(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active || profile.role !== "ADMIN") {
    throw new AuthError("Acesso restrito ao administrador.");
  }
  return profile;
}

export async function requireActiveUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile || !profile.is_active) {
    throw new AuthError("Não autenticado.");
  }
  return profile;
}

export class AuthError extends Error {}
