import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchToAdminOutbox } from "@/lib/admin-notifications";

const SP_OFFSET_MS = 3 * 60 * 60 * 1000; // America/Sao_Paulo = UTC-3, sem horário de verão desde 2019.
const DIVISOR = "▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬";

export type Periodo = "diario" | "semanal" | "mensal";

const STATUS_ORDER = [
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

const STATUS_LABEL: Record<string, string> = {
  NOVO: "Novo",
  CONTATO_REALIZADO: "Contato realizado",
  INTERAGINDO: "Interagindo",
  QUALIFICADO: "Qualificado",
  REUNIAO_AGENDADA: "Reunião agendada",
  PROPOSTA_ENVIADA: "Proposta enviada",
  NEGOCIACAO: "Negociação",
  GANHO: "Ganho",
  PERDIDO: "Perdido",
  SEM_INTERESSE: "Sem interesse",
  SEM_RESPOSTA: "Sem resposta",
};

const CLASSIFICACAO_ORDER = ["QUENTE", "QUALIFICADO", "MORNO", "FRIO"];
const CLASSIFICACAO_LABEL: Record<string, string> = {
  QUENTE: "🔥 Quente",
  QUALIFICADO: "🟠 Qualificado",
  MORNO: "🟡 Morno",
  FRIO: "🔵 Frio",
};

const ORIGEM_LABEL: Record<string, string> = {
  manual: "Cadastro manual",
  scraper: "Prospecção",
  campanha: "Campanha",
  whatsapp_inbound: "WhatsApp (contato espontâneo)",
};

export function spDateString(d: Date): string {
  const sp = new Date(d.getTime() - SP_OFFSET_MS);
  return sp.toISOString().slice(0, 10);
}

export function spDayStartUtc(d: Date): Date {
  const sp = new Date(d.getTime() - SP_OFFSET_MS);
  const midnightSp = Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate(), 0, 0, 0);
  return new Date(midnightSp + SP_OFFSET_MS);
}

function spParts(d: Date) {
  const sp = new Date(d.getTime() - SP_OFFSET_MS);
  return { year: sp.getUTCFullYear(), month: sp.getUTCMonth(), day: sp.getUTCDate(), weekday: sp.getUTCDay() };
}

// Formata em DD/MM no horário de SP -- nunca fatiar o ISO (UTC) direto:
// os últimos instantes de um dia em SP (UTC-3) já caem no dia seguinte em
// UTC, o que empurrava a data de exibição pra frente (ex: 31/07 23:59 SP
// virava "01/08" na tela).
function fmtDataCurta(d: Date): string {
  const sp = new Date(d.getTime() - SP_OFFSET_MS);
  const dd = String(sp.getUTCDate()).padStart(2, "0");
  const mm = String(sp.getUTCMonth() + 1).padStart(2, "0");
  return `${dd}/${mm}`;
}

// Último dia do mês (horário de SP) -- usado pela regra "ultimo_dia".
export function isUltimoDiaDoMes(d: Date): boolean {
  const { year, month, day } = spParts(d);
  const ultimoDia = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return day === ultimoDia;
}

// Última ocorrência de um dia da semana no mês (ex: última sexta) -- se
// somar 7 dias e cair no mês seguinte, não tem mais nenhuma esse mês.
export function isUltimaOcorrenciaDoDiaSemanaNoMes(d: Date, weekday: number): boolean {
  const { year, month, day, weekday: hoje } = spParts(d);
  if (hoje !== weekday) return false;
  const ultimoDiaDoMes = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  return day + 7 > ultimoDiaDoMes;
}

const TITULO: Record<Periodo, string> = {
  diario: "📈 *BASE7 CRM — Fechamento do dia*",
  semanal: "📊 *BASE7 CRM — Resumo semanal*",
  mensal: "📅 *BASE7 CRM — Fechamento do mês*",
};

// periodoRange calcula início/fim em UTC. "fim" só é diferente de "agora"
// no caso do preview manual do mensal (mesAnterior) -- os outros períodos
// sempre vão até "agora", que já é o limite natural (nada no banco tem
// created_at no futuro).
function periodoRange(periodo: Periodo, agora: Date, mesAnterior: boolean): { inicio: Date; fim: Date } {
  if (periodo === "diario") return { inicio: spDayStartUtc(agora), fim: agora };
  if (periodo === "semanal") {
    return { inicio: spDayStartUtc(new Date(agora.getTime() - 6 * 24 * 60 * 60 * 1000)), fim: agora };
  }
  const { year, month } = spParts(agora);
  if (mesAnterior) {
    const inicioMesAtual = new Date(Date.UTC(year, month, 1) + SP_OFFSET_MS);
    const inicioMesAnterior = new Date(Date.UTC(year, month - 1, 1) + SP_OFFSET_MS);
    return { inicio: inicioMesAnterior, fim: new Date(inicioMesAtual.getTime() - 1) };
  }
  return { inicio: new Date(Date.UTC(year, month, 1) + SP_OFFSET_MS), fim: agora };
}

function pct(num: number, den: number): string {
  if (den <= 0) return "—";
  return `${Math.round((num / den) * 100)}%`;
}

// Monta o texto do relatório -- retorna null quando não há nada a reportar
// (só se aplica ao diário, pra não gerar 1 mensagem por dia sem atividade
// nenhuma; semanal/mensal sempre mandam, mesmo "zerados", porque são raros
// o bastante pra um resumo vazio ainda ser informação relevante).
export async function gerarRelatorio(
  periodo: Periodo,
  agora: Date = new Date(),
  opts: { forcar?: boolean } = {}
): Promise<string | null> {
  const supabaseAdmin = createAdminClient();
  // Preview manual do mensal mostra o mês anterior completo em vez do mês
  // corrente até hoje -- senão, testado no dia 5, mostraria só 5 dias (um
  // recorte parcial e pouco útil pra conferir como o relatório fica).
  const mesAnterior = !!opts.forcar && periodo === "mensal";
  const { inicio, fim } = periodoRange(periodo, agora, mesAnterior);
  const since = inicio.toISOString();
  const ate = fim.toISOString();
  const limitarFim = mesAnterior; // só precisa de .lte explícito nesse caso

  let eventosQuery = supabaseAdmin
    .from("lead_events")
    .select("type, lead_id, created_at")
    .in("type", ["FIRST_CONTACT_SENT", "LEAD_REPLIED", "SALE_WON", "LEAD_LOST"])
    .gte("created_at", since);
  let mensagensQuery = supabaseAdmin.from("messages").select("direction, created_at").gte("created_at", since);
  let alertasQuery = supabaseAdmin
    .from("admin_alert_queue")
    .select("id, payload, created_at")
    .eq("type", "WHATSAPP_DISCONNECTED")
    .gte("created_at", since);
  if (limitarFim) {
    eventosQuery = eventosQuery.lte("created_at", ate);
    mensagensQuery = mensagensQuery.lte("created_at", ate);
    alertasQuery = alertasQuery.lte("created_at", ate);
  }

  const [{ data: leads }, { data: eventos }, { data: mensagens }, { data: leadsParados }, { data: consultores }, { data: alertasWpp }] =
    await Promise.all([
      supabaseAdmin.from("leads").select("id, empresa, status, classificacao, origem, responsavel_id, created_at"),
      eventosQuery,
      mensagensQuery,
      supabaseAdmin.from("leads_parados").select("lead_id, empresa, motivo"),
      supabaseAdmin.from("profiles").select("id, full_name").eq("role", "CONSULTOR_COMERCIAL").eq("is_active", true),
      alertasQuery,
    ]);

  const novos = (leads ?? []).filter((l) => l.created_at >= since && (!limitarFim || l.created_at <= ate));
  const contatos = (eventos ?? []).filter((e) => e.type === "FIRST_CONTACT_SENT").length;
  const respostas = (eventos ?? []).filter((e) => e.type === "LEAD_REPLIED").length;
  const vendas = (eventos ?? []).filter((e) => e.type === "SALE_WON").length;
  const perdidos = (eventos ?? []).filter((e) => e.type === "LEAD_LOST").length;
  const enviadas = (mensagens ?? []).filter((m) => m.direction === "OUT").length;
  const recebidas = (mensagens ?? []).filter((m) => m.direction === "IN").length;

  if (!opts.forcar && periodo === "diario" && novos.length === 0 && contatos === 0 && respostas === 0 && vendas === 0) {
    return null;
  }

  // Ranking de vendas e de engajamento (contatos + respostas) por consultor
  // no período -- reconhece quem tá vendendo E quem tá trabalhando a base.
  const leadsByConsultor = new Map((leads ?? []).map((l) => [l.id, l.responsavel_id]));
  const vendasPorConsultor = new Map<string, number>();
  const engajamentoPorConsultor = new Map<string, number>();
  for (const e of eventos ?? []) {
    const responsavelId = leadsByConsultor.get(e.lead_id);
    if (!responsavelId) continue;
    if (e.type === "SALE_WON") vendasPorConsultor.set(responsavelId, (vendasPorConsultor.get(responsavelId) ?? 0) + 1);
    if (e.type === "FIRST_CONTACT_SENT" || e.type === "LEAD_REPLIED") {
      engajamentoPorConsultor.set(responsavelId, (engajamentoPorConsultor.get(responsavelId) ?? 0) + 1);
    }
  }
  const rankingVendas = (consultores ?? [])
    .map((c) => ({ nome: c.full_name, valor: vendasPorConsultor.get(c.id) ?? 0 }))
    .filter((r) => r.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);
  const rankingEngajamento = (consultores ?? [])
    .map((c) => ({ nome: c.full_name, valor: engajamentoPorConsultor.get(c.id) ?? 0 }))
    .filter((r) => r.valor > 0)
    .sort((a, b) => b.valor - a.valor)
    .slice(0, 5);

  const porStatus: Record<string, number> = {};
  const porClassificacao: Record<string, number> = {};
  for (const l of leads ?? []) {
    porStatus[l.status] = (porStatus[l.status] ?? 0) + 1;
    porClassificacao[l.classificacao] = (porClassificacao[l.classificacao] ?? 0) + 1;
  }

  const porOrigem: Record<string, number> = {};
  for (const l of novos) {
    porOrigem[l.origem] = (porOrigem[l.origem] ?? 0) + 1;
  }

  const dataInicio = fmtDataCurta(inicio);
  const dataFim = fmtDataCurta(fim);
  const periodoLabel = periodo === "diario" ? dataFim : `${dataInicio} a ${dataFim}`;

  const lines: string[] = [TITULO[periodo], `🗓️ Período: ${periodoLabel}`, DIVISOR, ""];

  lines.push(
    "*📊 Atividade do período*",
    `📥 Novos leads: *${novos.length}*`,
    `📤 Contatos realizados: *${contatos}*`,
    `📩 Respostas recebidas: *${respostas}* (${pct(respostas, contatos)} de resposta)`,
    `🤝 Vendas fechadas: *${vendas}* (${pct(vendas, novos.length)} de fechamento sobre os novos)`,
    `❌ Leads perdidos: *${perdidos}*`,
    "",
    "*💬 Mensagens no período*",
    `Enviadas: *${enviadas}* · Recebidas: *${recebidas}*`,
    ""
  );

  if (rankingVendas.length > 0) {
    lines.push("*🏆 Ranking de vendas*");
    rankingVendas.forEach((r, i) => lines.push(`${i + 1}. ${r.nome} — ${r.valor}`));
    lines.push("");
  }

  if (rankingEngajamento.length > 0) {
    lines.push("*📞 Ranking de engajamento* (contatos + respostas)");
    rankingEngajamento.forEach((r, i) => lines.push(`${i + 1}. ${r.nome} — ${r.valor}`));
    lines.push("");
  }

  if (novos.length > 0 && Object.keys(porOrigem).length > 0) {
    lines.push("*🌐 Origem dos novos leads*");
    for (const [origem, qtd] of Object.entries(porOrigem).sort((a, b) => b[1] - a[1])) {
      lines.push(`${ORIGEM_LABEL[origem] ?? origem}: ${qtd}`);
    }
    lines.push("");
  }

  lines.push("*🎯 Funil atual* (todos os leads, não só do período)");
  for (const status of STATUS_ORDER) {
    if (!porStatus[status]) continue;
    lines.push(`${STATUS_LABEL[status]}: ${porStatus[status]}`);
  }
  lines.push("");

  lines.push("*🌡️ Classificação atual*");
  for (const c of CLASSIFICACAO_ORDER) {
    if (!porClassificacao[c]) continue;
    lines.push(`${CLASSIFICACAO_LABEL[c]}: ${porClassificacao[c]}`);
  }
  lines.push("");

  if ((leadsParados ?? []).length > 0) {
    lines.push(`*⚠️ Leads sem acompanhamento:* ${leadsParados!.length}`);
    for (const lp of leadsParados!.slice(0, 5)) {
      lines.push(`   • ${lp.empresa}`);
    }
    if (leadsParados!.length > 5) lines.push(`   ... e mais ${leadsParados!.length - 5}`);
    lines.push("");
  }

  if ((alertasWpp ?? []).length > 0) {
    lines.push(`*🔴 Desconexões de WhatsApp no período:* ${alertasWpp!.length}`);
    lines.push("");
  }

  lines.push(DIVISOR, `👥 Consultores ativos: ${consultores?.length ?? 0}`);

  return lines.join("\n");
}

export async function enviarRelatorio(
  periodo: Periodo,
  agora: Date = new Date(),
  opts: { forcar?: boolean } = {}
): Promise<{ sent: boolean; reason?: string }> {
  const texto = await gerarRelatorio(periodo, agora, opts);
  if (!texto) return { sent: false, reason: "sem atividade no período" };
  return dispatchToAdminOutbox(texto);
}
