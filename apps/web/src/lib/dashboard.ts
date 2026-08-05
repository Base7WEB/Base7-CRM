import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export type Period = "hoje" | "7d" | "30d" | "tudo";

export function periodStart(period: Period): string | null {
  const now = new Date();
  if (period === "hoje") {
    const d = new Date(now);
    d.setHours(0, 0, 0, 0);
    return d.toISOString();
  }
  if (period === "7d") return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  if (period === "30d") return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();
  return null;
}

export interface DashboardMetrics {
  totalLeads: number;
  porStatus: Record<string, number>;
  porClassificacao: Record<string, number>;
  contatosRealizados: number;
  respostas: number;
  vendas: number;
  perdidos: number;
  mensagensEnviadas: number;
  mensagensRecebidas: number;
  // null = sem dados suficientes pra calcular (evita divisao por zero)
  taxaResposta: number | null;
  taxaFechamento: number | null;
  leadsParados: { lead_id: string; empresa: string; motivo: string; ultima_mensagem_em: string }[];
  leadsRecentes: { id: string; empresa: string; status: string; classificacao: string; created_at: string }[];
}

type LeadParadoRow = {
  lead_id: string | null;
  empresa: string | null;
  motivo: string | null;
  ultima_mensagem_em: string | null;
};

function isCompleteLeadParado(
  row: LeadParadoRow
): row is { lead_id: string; empresa: string; motivo: string; ultima_mensagem_em: string } {
  return !!row.lead_id && !!row.empresa && !!row.motivo && !!row.ultima_mensagem_em;
}

const EMPTY_METRICS: DashboardMetrics = {
  totalLeads: 0,
  porStatus: {},
  porClassificacao: {},
  contatosRealizados: 0,
  respostas: 0,
  vendas: 0,
  perdidos: 0,
  mensagensEnviadas: 0,
  mensagensRecebidas: 0,
  taxaResposta: null,
  taxaFechamento: null,
  leadsParados: [],
  leadsRecentes: [],
};

export async function computeDashboardMetrics(
  supabase: SupabaseClient<Database>,
  opts: { responsavelId?: string; period: Period }
): Promise<DashboardMetrics> {
  let leadsQuery = supabase.from("leads").select("id, status, classificacao");
  if (opts.responsavelId) leadsQuery = leadsQuery.eq("responsavel_id", opts.responsavelId);
  const { data: leads } = await leadsQuery;

  if (!leads || leads.length === 0) return EMPTY_METRICS;

  const porStatus: Record<string, number> = {};
  const porClassificacao: Record<string, number> = {};
  for (const l of leads) {
    porStatus[l.status] = (porStatus[l.status] ?? 0) + 1;
    porClassificacao[l.classificacao] = (porClassificacao[l.classificacao] ?? 0) + 1;
  }

  const leadIds = leads.map((l) => l.id);
  const since = periodStart(opts.period);

  let eventsQuery = supabase
    .from("lead_events")
    .select("type, lead_id, created_at")
    .in("type", ["FIRST_CONTACT_SENT", "LEAD_REPLIED", "SALE_WON", "LEAD_LOST"])
    .in("lead_id", leadIds);
  if (since) eventsQuery = eventsQuery.gte("created_at", since);
  const { data: events } = await eventsQuery;

  const contatosRealizados = (events ?? []).filter((e) => e.type === "FIRST_CONTACT_SENT").length;
  const respostas = (events ?? []).filter((e) => e.type === "LEAD_REPLIED").length;
  const vendas = (events ?? []).filter((e) => e.type === "SALE_WON").length;
  const perdidos = (events ?? []).filter((e) => e.type === "LEAD_LOST").length;

  let parQuery = supabase.from("leads_parados").select("lead_id, empresa, motivo, ultima_mensagem_em");
  if (opts.responsavelId) parQuery = parQuery.eq("responsavel_id", opts.responsavelId);
  const { data: leadsParados } = await parQuery;

  let messagesQuery = supabase.from("messages").select("direction").in("lead_id", leadIds);
  if (since) messagesQuery = messagesQuery.gte("created_at", since);
  const { data: messages } = await messagesQuery;
  const mensagensEnviadas = (messages ?? []).filter((m) => m.direction === "OUT").length;
  const mensagensRecebidas = (messages ?? []).filter((m) => m.direction === "IN").length;

  let recentesQuery = supabase
    .from("leads")
    .select("id, empresa, status, classificacao, created_at")
    .order("created_at", { ascending: false })
    .limit(6);
  if (opts.responsavelId) recentesQuery = recentesQuery.eq("responsavel_id", opts.responsavelId);
  const { data: leadsRecentes } = await recentesQuery;

  return {
    totalLeads: leads.length,
    porStatus,
    porClassificacao,
    contatosRealizados,
    respostas,
    vendas,
    perdidos,
    mensagensEnviadas,
    mensagensRecebidas,
    taxaResposta: contatosRealizados > 0 ? respostas / contatosRealizados : null,
    taxaFechamento: leads.length > 0 ? vendas / leads.length : null,
    leadsParados: (leadsParados ?? []).filter(isCompleteLeadParado),
    leadsRecentes: leadsRecentes ?? [],
  };
}
