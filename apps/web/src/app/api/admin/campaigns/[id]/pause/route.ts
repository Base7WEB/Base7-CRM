import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const { id } = await params;
  const supabaseAdmin = createAdminClient();

  const { data: campaign } = await supabaseAdmin.from("campaigns").select("status").eq("id", id).single();
  if (!campaign) return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  if (campaign.status !== "EM_EXECUCAO") {
    return NextResponse.json({ error: "Só é possível pausar campanhas em execução." }, { status: 400 });
  }

  // Remove da fila o que ainda nao foi enviado (preserva o que ja foi --
  // isso e o "progresso") e devolve esses leads pra PENDENTE, prontos pra
  // retomar do zero do ponto em que pararam quando o admin der Iniciar de
  // novo.
  await supabaseAdmin.from("outbox_messages").delete().eq("campaign_id", id).eq("status", "PENDING");
  await supabaseAdmin
    .from("campaign_leads")
    .update({ status: "PENDENTE", outbox_message_id: null, updated_at: new Date().toISOString() })
    .eq("campaign_id", id)
    .eq("status", "ENFILEIRADO");

  await supabaseAdmin.from("campaigns").update({ status: "PAUSADA" }).eq("id", id);

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: admin.id,
    action: "CAMPAIGN_PAUSED",
    target_table: "campaigns",
    target_id: id,
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}
