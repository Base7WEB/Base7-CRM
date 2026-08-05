import { NextResponse } from "next/server";
import { requireActiveUser, AuthError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type LeadStatus = Database["public"]["Tables"]["leads"]["Row"]["status"];

const VALID_STATUSES: LeadStatus[] = [
  "NOVO",
  "CONTATO_REALIZADO",
  "INTERAGINDO",
  "QUALIFICADO",
  "REUNIAO_AGENDADA",
  "PROPOSTA_ENVIADA",
  "NEGOCIACAO",
  "GANHO",
  "PERDIDO",
  "SEM_INTERESSE",
  "SEM_RESPOSTA",
];

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let user;
  try {
    user = await requireActiveUser();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 401 });
    throw err;
  }

  const { id } = await params;
  const body = await request.json();
  const status = body.status as LeadStatus;
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "Status inválido." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { data: lead } = await supabaseAdmin.from("leads").select("id, status, empresa, responsavel_id").eq("id", id).single();

  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  }
  if (user.role !== "ADMIN" && lead.responsavel_id !== user.id) {
    return NextResponse.json({ error: "Você só pode alterar os próprios leads." }, { status: 403 });
  }

  const previousStatus = lead.status;

  const { error } = await supabaseAdmin.from("leads").update({ status }).eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  if (status === "GANHO" && previousStatus !== "GANHO") {
    await supabaseAdmin.from("lead_events").insert({
      lead_id: id,
      type: "SALE_WON",
      actor_id: user.id,
      payload: { previous_status: previousStatus },
    });
  }
  if (status === "PERDIDO" && previousStatus !== "PERDIDO") {
    await supabaseAdmin.from("lead_events").insert({
      lead_id: id,
      type: "LEAD_LOST",
      actor_id: user.id,
      payload: { previous_status: previousStatus },
    });
  }

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: user.id,
    action: "LEAD_STATUS_CHANGED",
    target_table: "leads",
    target_id: id,
    metadata: { empresa: lead.empresa, de: previousStatus, para: status },
  });

  return NextResponse.json({ ok: true });
}
