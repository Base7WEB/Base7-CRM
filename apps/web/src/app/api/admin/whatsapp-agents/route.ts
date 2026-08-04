import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAgentToken, hashAgentToken } from "@/lib/agent-auth";

// Gera um novo token de agente para um perfil (consultor ou o próprio
// admin). O token em texto plano só existe nesta resposta -- só o hash
// fica persistido. Gerar um novo token revoga o anterior automaticamente.
export async function POST(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const body = await request.json();
  const profileId = String(body.profile_id ?? "");
  if (!profileId) {
    return NextResponse.json({ error: "profile_id é obrigatório." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  const { data: profile } = await supabaseAdmin.from("profiles").select("id, full_name").eq("id", profileId).single();
  if (!profile) {
    return NextResponse.json({ error: "Usuário não encontrado." }, { status: 404 });
  }

  await supabaseAdmin
    .from("consultant_agent_tokens")
    .update({ revoked_at: new Date().toISOString() })
    .eq("profile_id", profileId)
    .is("revoked_at", null);

  const token = generateAgentToken();
  const { error } = await supabaseAdmin.from("consultant_agent_tokens").insert({
    profile_id: profileId,
    token_hash: hashAgentToken(token),
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabaseAdmin.from("whatsapp_sessions").upsert({ profile_id: profileId, status: "DISCONNECTED" });

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: admin.id,
    action: "WHATSAPP_AGENT_TOKEN_GENERATED",
    target_table: "profiles",
    target_id: profileId,
    metadata: { full_name: profile.full_name },
  });

  return NextResponse.json({ token });
}
