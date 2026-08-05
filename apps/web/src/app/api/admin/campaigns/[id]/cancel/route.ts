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

  // Remove da fila mensagens que ainda nao foram enviadas -- as ja SENT
  // permanecem no historico normalmente.
  await supabaseAdmin.from("outbox_messages").delete().eq("campaign_id", id).eq("status", "PENDING");

  await supabaseAdmin
    .from("campaign_leads")
    .update({ status: "PULADO", updated_at: new Date().toISOString() })
    .eq("campaign_id", id)
    .in("status", ["PENDENTE", "ENFILEIRADO"]);

  await supabaseAdmin.from("campaigns").update({ status: "CANCELADA" }).eq("id", id);

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: admin.id,
    action: "CAMPAIGN_CANCELLED",
    target_table: "campaigns",
    target_id: id,
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}
