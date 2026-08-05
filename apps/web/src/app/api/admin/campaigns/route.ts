import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/types";

type LeadStatus = Database["public"]["Tables"]["leads"]["Row"]["status"];

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const supabaseAdmin = createAdminClient();
  const { data: campaigns, error } = await supabaseAdmin
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = await Promise.all(
    (campaigns ?? []).map(async (c) => {
      const { data: leads } = await supabaseAdmin.from("campaign_leads").select("status").eq("campaign_id", c.id);
      const counts = { total: leads?.length ?? 0, enviado: 0, falhou: 0, pendente: 0 };
      for (const l of leads ?? []) {
        if (l.status === "ENVIADO") counts.enviado++;
        else if (l.status === "FALHOU") counts.falhou++;
        else counts.pendente++;
      }
      return { ...c, counts };
    })
  );

  return NextResponse.json({ campaigns: results });
}

export async function POST(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const body = await request.json();
  const nome = String(body.nome ?? "").trim();
  const corpoMensagem = String(body.corpo_mensagem ?? "").trim();
  const statusFiltro = body.status_filtro as LeadStatus;
  const intervaloMin = Number(body.intervalo_min_seg ?? 30);
  const intervaloMax = Number(body.intervalo_max_seg ?? 90);

  if (!nome || !corpoMensagem || !statusFiltro) {
    return NextResponse.json({ error: "nome, corpo_mensagem e status_filtro são obrigatórios." }, { status: 400 });
  }
  if (intervaloMin < 15 || intervaloMax < intervaloMin) {
    return NextResponse.json({ error: "intervalo mínimo deve ser >= 15s e menor ou igual ao máximo." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .insert({
      nome,
      corpo_mensagem: corpoMensagem,
      intervalo_min_seg: intervaloMin,
      intervalo_max_seg: intervaloMax,
      created_by: admin.id,
    })
    .select()
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: campaignError?.message ?? "Erro ao criar campanha." }, { status: 500 });
  }

  // So inclui leads com responsavel definido -- sem isso nao tem de qual
  // WhatsApp enviar.
  const { data: leads } = await supabaseAdmin
    .from("leads")
    .select("id")
    .eq("status", statusFiltro)
    .not("responsavel_id", "is", null);

  if (leads && leads.length > 0) {
    await supabaseAdmin.from("campaign_leads").insert(leads.map((l) => ({ campaign_id: campaign.id, lead_id: l.id })));
  }

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: admin.id,
    action: "CAMPAIGN_CREATED",
    target_table: "campaigns",
    target_id: campaign.id,
    metadata: { nome, status_filtro: statusFiltro, leads_incluidos: leads?.length ?? 0 },
  });

  return NextResponse.json({ campaign, leads_incluidos: leads?.length ?? 0 }, { status: 201 });
}
