import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";

export function generateAgentToken(): string {
  return randomBytes(32).toString("hex");
}

export function hashAgentToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

// Autenticação de MÁQUINA (agente local), não de usuário -- nunca usa JWT
// Supabase. Resolve o Bearer token pro profile_id dono dele, checando que
// o token não foi revogado.
export async function resolveAgentProfileId(request: Request): Promise<string | null> {
  const auth = request.headers.get("authorization") ?? "";
  const [scheme, token] = auth.split(" ");
  if (scheme !== "Bearer" || !token) return null;

  const supabaseAdmin = createAdminClient();
  const { data } = await supabaseAdmin
    .from("consultant_agent_tokens")
    .select("profile_id")
    .eq("token_hash", hashAgentToken(token))
    .is("revoked_at", null)
    .single();

  return data?.profile_id ?? null;
}
