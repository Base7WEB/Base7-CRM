import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
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
  const responsavelId: string | null = body.responsavel_id || null;

  const supabaseAdmin = createAdminClient();

  const { data: lead, error: fetchError } = await supabaseAdmin
    .from("leads")
    .select("id, empresa, responsavel_id")
    .eq("id", id)
    .single();
  if (fetchError || !lead) {
    return NextResponse.json({ error: "Lead não encontrado." }, { status: 404 });
  }

  const { error } = await supabaseAdmin.from("leads").update({ responsavel_id: responsavelId }).eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: admin.id,
    action: "LEAD_REASSIGNED",
    target_table: "leads",
    target_id: id,
    metadata: {
      empresa: lead.empresa,
      responsavel_anterior: lead.responsavel_id,
      responsavel_novo: responsavelId,
    },
  });

  return NextResponse.json({ ok: true });
}
