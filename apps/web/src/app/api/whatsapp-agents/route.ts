import { NextResponse } from "next/server";
import { requireActiveUser, AuthError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAgentToken, hashAgentToken } from "@/lib/agent-auth";

// Gera um novo token de agente pra um perfil (WhatsApp e scraper usam o
// mesmo mecanismo). O admin pode gerar pra qualquer consultor; qualquer
// usuário ativo pode gerar o PRÓPRIO token, sem precisar pedir pro admin
// (é a própria conexão de WhatsApp/scraper dele). O token em texto plano só
// existe nesta resposta -- só o hash fica persistido. Gerar um novo token
// revoga o anterior automaticamente.
export async function POST(request: Request) {
  let caller;
  try {
    caller = await requireActiveUser();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const body = await request.json();
  const requestedProfileId = String(body.profile_id ?? "");
  if (caller.role !== "ADMIN" && requestedProfileId && requestedProfileId !== caller.id) {
    return NextResponse.json({ error: "Você só pode gerar o próprio token." }, { status: 403 });
  }
  const profileId = caller.role === "ADMIN" && requestedProfileId ? requestedProfileId : caller.id;

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
    actor_id: caller.id,
    action: "WHATSAPP_AGENT_TOKEN_GENERATED",
    target_table: "profiles",
    target_id: profileId,
    metadata: { full_name: profile.full_name, self_service: profileId === caller.id && caller.role !== "ADMIN" },
  });

  return NextResponse.json({ token });
}
