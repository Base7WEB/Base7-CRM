import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

const REUNIAO_OU_ALEM = ["REUNIAO_AGENDADA", "PROPOSTA_ENVIADA", "NEGOCIACAO", "GANHO"];
const PROPOSTA_OU_ALEM = ["PROPOSTA_ENVIADA", "NEGOCIACAO", "GANHO"];

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const { id } = await params;
  const supabaseAdmin = createAdminClient();

  const { data: campaign } = await supabaseAdmin.from("campaigns").select("*").eq("id", id).single();
  if (!campaign) return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });

  let responsavel_nome: string | null = null;
  if (campaign.responsavel_id) {
    const { data: responsavel } = await supabaseAdmin
      .from("profiles")
      .select("full_name")
      .eq("id", campaign.responsavel_id)
      .single();
    responsavel_nome = responsavel?.full_name ?? null;
  }

  const { data: followups } = await supabaseAdmin
    .from("campaign_followups")
    .select("*")
    .eq("campaign_id", id)
    .order("ordem", { ascending: true });

  const { data: campaignLeads } = await supabaseAdmin
    .from("campaign_leads")
    .select(
      "id, status, updated_at, simulado, followups_enviados, lead_id, leads(id, empresa, telefone, status, classificacao, responsavel_id)"
    )
    .eq("campaign_id", id)
    .order("updated_at", { ascending: false });

  const leadIds = (campaignLeads ?? []).map((cl) => cl.lead_id);

  let respostas = 0;
  if (leadIds.length > 0) {
    const { data: events } = await supabaseAdmin
      .from("lead_events")
      .select("lead_id")
      .eq("type", "LEAD_REPLIED")
      .in("lead_id", leadIds);
    respostas = new Set((events ?? []).map((e) => e.lead_id)).size;
  }

  const enviado = (campaignLeads ?? []).filter((cl) => cl.status === "ENVIADO").length;
  const falhou = (campaignLeads ?? []).filter((cl) => cl.status === "FALHOU").length;
  const pulado = (campaignLeads ?? []).filter((cl) => cl.status === "PULADO").length;
  const pendente = (campaignLeads ?? []).filter((cl) => cl.status === "PENDENTE" || cl.status === "ENFILEIRADO").length;

  const leadsAtuais = (campaignLeads ?? [])
    .map((cl) => cl.leads as unknown as { status: string; classificacao: string } | null)
    .filter((l): l is { status: string; classificacao: string } => !!l);

  const quentes = leadsAtuais.filter((l) => l.classificacao === "QUENTE").length;
  const reunioes = leadsAtuais.filter((l) => REUNIAO_OU_ALEM.includes(l.status)).length;
  const propostas = leadsAtuais.filter((l) => PROPOSTA_OU_ALEM.includes(l.status)).length;
  const vendas = leadsAtuais.filter((l) => l.status === "GANHO").length;

  return NextResponse.json({
    campaign: { ...campaign, responsavel_nome },
    followups: followups ?? [],
    leads: campaignLeads ?? [],
    metrics: {
      total: campaignLeads?.length ?? 0,
      enviado,
      falhou,
      pulado,
      pendente,
      respostas,
      taxaResposta: enviado > 0 ? respostas / enviado : null,
      quentes,
      reunioes,
      propostas,
      vendas,
    },
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const { id } = await params;
  const supabaseAdmin = createAdminClient();

  const { data: campaign } = await supabaseAdmin.from("campaigns").select("status, nome").eq("id", id).single();
  if (!campaign) return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  if (campaign.status === "EM_EXECUCAO" || campaign.status === "PAUSADA") {
    return NextResponse.json({ error: "Pare a campanha antes de excluí-la." }, { status: 400 });
  }

  const { error } = await supabaseAdmin.from("campaigns").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: admin.id,
    action: "CAMPAIGN_DELETED",
    target_table: "campaigns",
    target_id: id,
    metadata: { nome: campaign.nome },
  });

  return NextResponse.json({ ok: true });
}
