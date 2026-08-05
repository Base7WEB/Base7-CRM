import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

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

  const { data: campaign } = await supabaseAdmin.from("campaigns").select("*").eq("id", id).single();
  if (!campaign) return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  if (campaign.status !== "RASCUNHO" && campaign.status !== "PAUSADA") {
    return NextResponse.json({ error: "Só é possível iniciar campanhas em rascunho ou pausadas." }, { status: 400 });
  }

  const { data: pendentes } = await supabaseAdmin
    .from("campaign_leads")
    .select("id, lead_id, leads(telefone, responsavel_id, empresa)")
    .eq("campaign_id", id)
    .eq("status", "PENDENTE");

  if (!pendentes || pendentes.length === 0) {
    return NextResponse.json({ error: "Nenhum lead pendente nesta campanha." }, { status: 400 });
  }

  const { error: statusError } = await supabaseAdmin.from("campaigns").update({ status: "EM_EXECUCAO" }).eq("id", id);
  if (statusError) {
    // provavelmente violou o unique index de "so 1 campanha em execucao"
    return NextResponse.json({ error: "Já existe outra campanha em execução. Finalize ou cancele antes." }, { status: 409 });
  }

  // Escalona por consultor -- cada um tem sua propria sequencia de horarios
  // (nao faz sentido esperar o intervalo de um consultor bloquear o envio
  // de outro).
  const nextSendAt = new Map<string, number>();
  const now = Date.now();
  let enfileirados = 0;

  for (const item of pendentes) {
    const lead = item.leads as unknown as { telefone: string; responsavel_id: string | null; empresa: string } | null;
    if (!lead?.telefone || !lead.responsavel_id) continue;

    const base = nextSendAt.get(lead.responsavel_id) ?? now;
    const sendAt = base;
    nextSendAt.set(
      lead.responsavel_id,
      base + randomInt(campaign.intervalo_min_seg, campaign.intervalo_max_seg) * 1000
    );

    const body = campaign.corpo_mensagem.replaceAll("{empresa}", lead.empresa ?? "");

    const { data: outboxRow, error: outboxError } = await supabaseAdmin
      .from("outbox_messages")
      .insert({
        profile_id: lead.responsavel_id,
        lead_id: item.lead_id,
        campaign_id: id,
        to_phone: lead.telefone,
        body,
        not_before: new Date(sendAt).toISOString(),
      })
      .select()
      .single();

    if (outboxError || !outboxRow) continue;

    await supabaseAdmin
      .from("campaign_leads")
      .update({ status: "ENFILEIRADO", outbox_message_id: outboxRow.id, updated_at: new Date().toISOString() })
      .eq("id", item.id);

    enfileirados++;
  }

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: admin.id,
    action: "CAMPAIGN_STARTED",
    target_table: "campaigns",
    target_id: id,
    metadata: { enfileirados },
  });

  return NextResponse.json({ ok: true, enfileirados });
}
