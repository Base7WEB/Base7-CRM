import { NextResponse } from "next/server";
import { resolveAgentProfileId } from "@/lib/agent-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const profileId = await resolveAgentProfileId(request);
  if (!profileId) {
    return NextResponse.json({ error: "Token inválido ou revogado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const status = body.status === "SENT" ? "SENT" : body.status === "FAILED" ? "FAILED" : null;
  if (!status) {
    return NextResponse.json({ error: "status deve ser SENT ou FAILED." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  // Só o dono (mesmo profile_id do token) pode atualizar o item -- impede
  // um agente marcar como enviada uma mensagem de fila de outro consultor.
  const { data: item } = await supabaseAdmin
    .from("outbox_messages")
    .select("id, profile_id, campaign_id, lead_id")
    .eq("id", id)
    .single();

  if (!item || item.profile_id !== profileId) {
    return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
  }

  const { error } = await supabaseAdmin
    .from("outbox_messages")
    .update({
      status,
      whatsapp_message_id: body.whatsapp_message_id ?? null,
      error: body.error ?? null,
      sent_at: status === "SENT" ? new Date().toISOString() : null,
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (item.campaign_id && item.lead_id) {
    await supabaseAdmin
      .from("campaign_leads")
      .update({ status: status === "SENT" ? "ENVIADO" : "FALHOU", updated_at: new Date().toISOString() })
      .eq("campaign_id", item.campaign_id)
      .eq("lead_id", item.lead_id);
  }

  return NextResponse.json({ ok: true });
}
