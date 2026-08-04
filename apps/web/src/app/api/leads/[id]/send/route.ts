import { NextResponse } from "next/server";
import { requireActiveUser, AuthError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(
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
  const text = String(body.body ?? "").trim();
  if (!text) {
    return NextResponse.json({ error: "Mensagem vazia." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { data: lead } = await supabaseAdmin.from("leads").select("id, telefone, responsavel_id").eq("id", id).single();

  if (!lead) {
    return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  }
  if (!lead.responsavel_id) {
    return NextResponse.json({ error: "Atribua um responsável ao lead antes de enviar mensagens." }, { status: 400 });
  }
  if (user.role !== "ADMIN" && lead.responsavel_id !== user.id) {
    return NextResponse.json({ error: "Você só pode enviar mensagens para os próprios leads." }, { status: 403 });
  }

  const { error } = await supabaseAdmin.from("outbox_messages").insert({
    profile_id: lead.responsavel_id,
    lead_id: lead.id,
    to_phone: lead.telefone,
    body: text,
  });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
