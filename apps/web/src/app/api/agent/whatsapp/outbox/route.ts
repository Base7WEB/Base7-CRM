import { NextResponse } from "next/server";
import { resolveAgentProfileId } from "@/lib/agent-auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(request: Request) {
  const profileId = await resolveAgentProfileId(request);
  if (!profileId) {
    return NextResponse.json({ error: "Token inválido ou revogado." }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();
  // limit(1): o agente local envia tudo que vier aqui de uma vez, sem pausa
  // entre itens -- um lote maior deixa a fila "presa" na memória do agente
  // por vários envios seguidos, ignorando na prática um Pausar/Cancelar que
  // aconteça nesse meio-tempo (o outbox_messages já foi apagado no banco,
  // mas o processo local já tinha o lote em mãos). Com 1 item por vez, o
  // agente busca de novo a cada poll e só um envio por ciclo fica exposto
  // a essa janela de corrida.
  const { data, error } = await supabaseAdmin
    .from("outbox_messages")
    .select("id, to_phone, body")
    .eq("profile_id", profileId)
    .eq("status", "PENDING")
    .or(`not_before.is.null,not_before.lte.${new Date().toISOString()}`)
    .order("created_at", { ascending: true })
    .limit(1);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: data });
}
