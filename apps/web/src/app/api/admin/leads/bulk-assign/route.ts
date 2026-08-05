import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const body = await request.json();
  const leadIds: string[] = Array.isArray(body.lead_ids)
    ? Array.from(new Set<string>(body.lead_ids.map((v: unknown) => String(v))))
    : [];
  const responsavelId: string | null = body.responsavel_id || null;

  if (leadIds.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos 1 lead." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  let responsavelNome: string | null = null;
  if (responsavelId) {
    const { data: perfil } = await supabaseAdmin.from("profiles").select("full_name").eq("id", responsavelId).single();
    if (!perfil) return NextResponse.json({ error: "Consultor não encontrado." }, { status: 404 });
    responsavelNome = perfil.full_name;
  }

  const { error } = await supabaseAdmin.from("leads").update({ responsavel_id: responsavelId }).in("id", leadIds);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: admin.id,
    action: "LEADS_BULK_REASSIGNED",
    target_table: "leads",
    target_id: null,
    metadata: { total: leadIds.length, responsavel_novo: responsavelId, responsavel_nome: responsavelNome },
  });

  return NextResponse.json({ ok: true, atualizados: leadIds.length });
}
