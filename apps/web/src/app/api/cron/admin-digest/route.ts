import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { dispatchToAdminOutbox } from "@/lib/admin-notifications";

// Chamado com mais frequencia que o limite de cron nativo da Vercel
// permite (plano Hobby = 1x/dia) via GitHub Actions -- ver
// .github/workflows/admin-digest.yml. Autenticado por CRON_SECRET,
// nao por sessao de usuario.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();

  const { data: settings } = await supabaseAdmin.from("admin_notification_settings").select("*").eq("id", 1).single();
  if (!settings) return NextResponse.json({ skipped: true, reason: "sem configuração" });

  const now = new Date();
  if (settings.last_digest_sent_at) {
    const elapsedMin = (now.getTime() - new Date(settings.last_digest_sent_at).getTime()) / 60000;
    if (elapsedMin < settings.digest_interval_minutes) {
      return NextResponse.json({ skipped: true, reason: "intervalo configurado ainda não passou" });
    }
  }

  const { data: alerts } = await supabaseAdmin.from("admin_alert_queue").select("*").eq("notified", false);
  const { data: leadsParados } = await supabaseAdmin.from("leads_parados").select("lead_id");

  const temAlertas = alerts && alerts.length > 0;
  const temParados = leadsParados && leadsParados.length > 0;

  if (!temAlertas && !temParados) {
    return NextResponse.json({ skipped: true, reason: "nada para reportar" });
  }

  const vendas = (alerts ?? []).filter((a) => a.type === "SALE_WON");
  const quentes = (alerts ?? []).filter((a) => a.type === "LEAD_HOT");
  const desconexoes = (alerts ?? []).filter((a) => a.type === "WHATSAPP_DISCONNECTED");

  const lines: string[] = ["📊 *BASE7 CRM — Resumo operacional*", ""];

  if (vendas.length > 0) {
    lines.push(`🤝 Vendas fechadas: ${vendas.length}`);
    for (const v of vendas) {
      const p = v.payload as { empresa?: string };
      lines.push(`   • ${p.empresa ?? "lead"}`);
    }
  }
  if (quentes.length > 0) {
    lines.push(`🔥 Novos leads quentes: ${quentes.length}`);
    for (const q of quentes) {
      const p = q.payload as { empresa?: string; score?: number };
      lines.push(`   • ${p.empresa ?? "lead"} (score ${p.score ?? "?"})`);
    }
  }
  if (desconexoes.length > 0) {
    lines.push(`🔴 WhatsApp desconectado: ${desconexoes.length}`);
    for (const d of desconexoes) {
      const p = d.payload as { full_name?: string };
      lines.push(`   • ${p.full_name ?? "consultor"}`);
    }
  }
  if (temParados) {
    lines.push(`⚠️ Leads sem acompanhamento: ${leadsParados!.length}`);
  }

  const text = lines.join("\n");
  const result = await dispatchToAdminOutbox(text);

  if (result.sent) {
    const ids = (alerts ?? []).map((a) => a.id);
    if (ids.length > 0) {
      await supabaseAdmin.from("admin_alert_queue").update({ notified: true }).in("id", ids);
    }
    await supabaseAdmin.from("admin_notification_settings").update({ last_digest_sent_at: now.toISOString() }).eq("id", 1);
  }

  return NextResponse.json({ sent: result.sent, reason: result.reason ?? null });
}
