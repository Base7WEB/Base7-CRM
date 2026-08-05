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
  const body = await request.json();
  const campaignLeadId = String(body.campaign_lead_id ?? "");
  if (!campaignLeadId) {
    return NextResponse.json({ error: "campaign_lead_id é obrigatório." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { data: campaignLead } = await supabaseAdmin
    .from("campaign_leads")
    .select("id, status, outbox_message_id, campaign_id")
    .eq("id", campaignLeadId)
    .eq("campaign_id", id)
    .single();

  if (!campaignLead) return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
  if (campaignLead.status === "ENVIADO") {
    return NextResponse.json({ error: "Mensagem já enviada, não dá pra pular." }, { status: 400 });
  }

  if (campaignLead.outbox_message_id) {
    await supabaseAdmin.from("outbox_messages").delete().eq("id", campaignLead.outbox_message_id).eq("status", "PENDING");
  }

  await supabaseAdmin
    .from("campaign_leads")
    .update({ status: "PULADO", updated_at: new Date().toISOString() })
    .eq("id", campaignLeadId);

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: admin.id,
    action: "CAMPAIGN_LEAD_SKIPPED",
    target_table: "campaign_leads",
    target_id: campaignLeadId,
    metadata: { campaign_id: id },
  });

  return NextResponse.json({ ok: true });
}
