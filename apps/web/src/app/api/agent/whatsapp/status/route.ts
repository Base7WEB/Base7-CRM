import { NextResponse } from "next/server";
import { resolveAgentProfileId } from "@/lib/agent-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type WhatsAppSessionUpsert = Database["public"]["Tables"]["whatsapp_sessions"]["Insert"];

const VALID_STATUSES = ["DISCONNECTED", "QR_PENDING", "CONNECTED"];

export async function POST(request: Request) {
  const profileId = await resolveAgentProfileId(request);
  if (!profileId) {
    return NextResponse.json({ error: "Token inválido ou revogado." }, { status: 401 });
  }

  const body = await request.json();
  const status = String(body.status ?? "");
  if (!VALID_STATUSES.includes(status)) {
    return NextResponse.json({ error: "status inválido." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const now = new Date().toISOString();

  const { data: previous } = await supabaseAdmin
    .from("whatsapp_sessions")
    .select("status")
    .eq("profile_id", profileId)
    .single();

  const update: WhatsAppSessionUpsert = {
    profile_id: profileId,
    status: status as WhatsAppSessionUpsert["status"],
    updated_at: now,
    ...(status === "CONNECTED" ? { last_connected_at: now } : {}),
    ...(status === "DISCONNECTED" ? { last_disconnected_at: now } : {}),
  };

  const { error } = await supabaseAdmin.from("whatsapp_sessions").upsert(update);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  if (previous?.status !== status) {
    await supabaseAdmin.from("audit_logs").insert({
      actor_id: null,
      action: `WHATSAPP_${status}`,
      target_table: "whatsapp_sessions",
      target_id: profileId,
      metadata: { previous_status: previous?.status ?? null },
    });
  }

  return NextResponse.json({ ok: true });
}
