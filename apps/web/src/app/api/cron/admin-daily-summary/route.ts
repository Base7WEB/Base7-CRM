import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchToAdminOutbox } from "@/lib/admin-notifications";

const SP_OFFSET_MS = 3 * 60 * 60 * 1000; // America/Sao_Paulo = UTC-3, sem horário de verão desde 2019.

function spDateString(d: Date): string {
  const sp = new Date(d.getTime() - SP_OFFSET_MS);
  return sp.toISOString().slice(0, 10);
}

function spDayStartUtc(d: Date): Date {
  const sp = new Date(d.getTime() - SP_OFFSET_MS);
  const midnightSp = Date.UTC(sp.getUTCFullYear(), sp.getUTCMonth(), sp.getUTCDate(), 0, 0, 0);
  return new Date(midnightSp + SP_OFFSET_MS);
}

// Cron nativo da Vercel (vercel.json), 1x/dia -- dentro do limite do plano
// Hobby. Roda perto do horario configurado e verifica internamente se ja
// e' hora e se ainda nao foi enviado hoje (last_daily_summary_sent_on).
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();
  const { data: settings } = await supabaseAdmin.from("admin_notification_settings").select("*").eq("id", 1).single();
  if (!settings) return NextResponse.json({ skipped: true, reason: "sem configuração" });

  const now = new Date();
  const today = spDateString(now);
  if (settings.last_daily_summary_sent_on === today) {
    return NextResponse.json({ skipped: true, reason: "já enviado hoje" });
  }

  const since = spDayStartUtc(now).toISOString();

  const { data: leads } = await supabaseAdmin.from("leads").select("id, responsavel_id, created_at");
  const novosHoje = (leads ?? []).filter((l) => l.created_at >= since).length;

  const { data: events } = await supabaseAdmin
    .from("lead_events")
    .select("type, lead_id, created_at")
    .in("type", ["FIRST_CONTACT_SENT", "LEAD_REPLIED", "SALE_WON"])
    .gte("created_at", since);

  const contatos = (events ?? []).filter((e) => e.type === "FIRST_CONTACT_SENT").length;
  const respostas = (events ?? []).filter((e) => e.type === "LEAD_REPLIED").length;
  const vendas = (events ?? []).filter((e) => e.type === "SALE_WON").length;

  const { data: leadsParados } = await supabaseAdmin.from("leads_parados").select("lead_id");

  const { data: consultores } = await supabaseAdmin
    .from("profiles")
    .select("id, full_name")
    .eq("role", "CONSULTOR_COMERCIAL")
    .eq("is_active", true);

  const leadsByConsultor = new Map((leads ?? []).map((l) => [l.id, l.responsavel_id]));
  const vendasPorConsultor = new Map<string, number>();
  for (const e of events ?? []) {
    if (e.type !== "SALE_WON") continue;
    const responsavelId = leadsByConsultor.get(e.lead_id);
    if (!responsavelId) continue;
    vendasPorConsultor.set(responsavelId, (vendasPorConsultor.get(responsavelId) ?? 0) + 1);
  }
  let melhorDesempenho: string | null = null;
  let melhorVendas = 0;
  for (const c of consultores ?? []) {
    const v = vendasPorConsultor.get(c.id) ?? 0;
    if (v > melhorVendas) {
      melhorVendas = v;
      melhorDesempenho = c.full_name;
    }
  }

  if (novosHoje === 0 && contatos === 0 && respostas === 0 && vendas === 0) {
    await supabaseAdmin.from("admin_notification_settings").update({ last_daily_summary_sent_on: today }).eq("id", 1);
    return NextResponse.json({ skipped: true, reason: "sem atividade hoje" });
  }

  const lines = [
    "📈 *BASE7 CRM — Fechamento do dia*",
    "",
    `👥 Consultores ativos: ${consultores?.length ?? 0}`,
    "",
    `📥 Novos leads: ${novosHoje}`,
    `📤 Contatos: ${contatos}`,
    `📩 Respostas: ${respostas}`,
    `🤝 Vendas: ${vendas}`,
    "",
    `⚠️ Leads sem acompanhamento: ${leadsParados?.length ?? 0}`,
  ];
  if (melhorDesempenho) {
    lines.push("", `🏆 Melhor desempenho: ${melhorDesempenho}`);
  }

  const result = await dispatchToAdminOutbox(lines.join("\n"));

  if (result.sent) {
    await supabaseAdmin.from("admin_notification_settings").update({ last_daily_summary_sent_on: today }).eq("id", 1);
  }

  return NextResponse.json({ sent: result.sent, reason: result.reason ?? null });
}
