import { NextResponse } from "next/server";
import { resolveAgentProfileId } from "@/lib/agent-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { toE164 } from "@/lib/phone";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { recomputeAndSaveLeadScore } from "@/lib/scoring/persist";

type LeadEventType = Database["public"]["Tables"]["lead_events"]["Row"]["type"];

async function insertEventIfNew(
  supabaseAdmin: SupabaseClient<Database>,
  event: { lead_id: string; type: LeadEventType; whatsapp_message_id?: string | null; payload?: Json }
): Promise<boolean> {
  const { error } = await supabaseAdmin.from("lead_events").insert({
    lead_id: event.lead_id,
    type: event.type,
    whatsapp_message_id: event.whatsapp_message_id ?? null,
    payload: event.payload ?? {},
  });
  if (error) {
    if (error.code === "23505") return false; // já existia -- idempotente
    throw new Error(error.message);
  }
  return true;
}

export async function POST(request: Request) {
  const profileId = await resolveAgentProfileId(request);
  if (!profileId) {
    return NextResponse.json({ error: "Token inválido ou revogado." }, { status: 401 });
  }

  const body = await request.json();
  const phone = toE164(String(body.phone ?? ""));
  const whatsappMessageId = String(body.whatsapp_message_id ?? "");
  const text = String(body.body ?? "").trim();
  const direction = body.direction === "IN" ? "IN" : body.direction === "OUT" ? "OUT" : null;

  if (!phone || !whatsappMessageId || !text || !direction) {
    return NextResponse.json({ error: "phone, whatsapp_message_id, body e direction são obrigatórios." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  let { data: lead } = await supabaseAdmin.from("leads").select("*").eq("telefone", phone).single();

  if (!lead) {
    const { data: created, error: createError } = await supabaseAdmin
      .from("leads")
      .insert({
        empresa: "Contato desconhecido",
        telefone: phone,
        responsavel_id: profileId,
        origem: "whatsapp_inbound",
        status: "NOVO",
      })
      .select()
      .single();
    if (createError || !created) {
      return NextResponse.json({ error: createError?.message ?? "Erro ao criar lead." }, { status: 500 });
    }
    lead = created;
    await recomputeAndSaveLeadScore(supabaseAdmin, lead.id);
  }

  const { data: insertedMessages, error: insertError } = await supabaseAdmin
    .from("messages")
    .upsert(
      {
        lead_id: lead.id,
        direction,
        body: text,
        whatsapp_message_id: whatsappMessageId,
        sent_by: direction === "OUT" ? profileId : null,
      },
      { onConflict: "whatsapp_message_id", ignoreDuplicates: true }
    )
    .select();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  if (!insertedMessages || insertedMessages.length === 0) {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  const now = new Date().toISOString();

  if (direction === "OUT") {
    const wasNew = await insertEventIfNew(supabaseAdmin, {
      lead_id: lead.id,
      type: "FIRST_CONTACT_SENT",
      whatsapp_message_id: whatsappMessageId,
    });
    if (wasNew) {
      await supabaseAdmin.from("leads").update({ status: "CONTATO_REALIZADO" }).eq("id", lead.id).eq("status", "NOVO");
      await recomputeAndSaveLeadScore(supabaseAdmin, lead.id);
    }
  }

  if (direction === "IN") {
    const wasNewReply = await insertEventIfNew(supabaseAdmin, {
      lead_id: lead.id,
      type: "LEAD_REPLIED",
      whatsapp_message_id: whatsappMessageId,
    });
    if (wasNewReply) {
      await insertEventIfNew(supabaseAdmin, { lead_id: lead.id, type: "CONVERSATION_STARTED" });
      await supabaseAdmin
        .from("leads")
        .update({ status: "INTERAGINDO" })
        .eq("id", lead.id)
        .in("status", ["NOVO", "CONTATO_REALIZADO"]);
      await recomputeAndSaveLeadScore(supabaseAdmin, lead.id);
    }
    await supabaseAdmin.from("leads").update({ last_interaction_at: now }).eq("id", lead.id);
  }

  return NextResponse.json({ ok: true, lead_id: lead.id });
}
