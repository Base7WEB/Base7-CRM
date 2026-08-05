import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  spDateString,
  isUltimoDiaDoMes,
  isUltimaOcorrenciaDoDiaSemanaNoMes,
  enviarRelatorio,
} from "@/lib/reports";

// Cron nativo da Vercel (vercel.json), 1x/dia -- dentro do limite do plano
// Hobby. O relatório semanal e mensal são checados dentro dessa MESMA
// execução (é o dia da semana configurado? bate a regra do mês
// configurada?) em vez de precisar de mais slots de cron.
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
  const resultado: Record<string, unknown> = {};

  if (settings.last_daily_summary_sent_on !== today) {
    const diario = await enviarRelatorio("diario", now);
    // Marca como "feito hoje" mesmo sem atividade nenhuma -- senão o cron
    // ficaria tentando de novo a cada execução do mesmo dia sem nunca ter
    // nada novo pra reportar.
    await supabaseAdmin.from("admin_notification_settings").update({ last_daily_summary_sent_on: today }).eq("id", 1);
    resultado.diario = diario;
  }

  const hojeEhDiaDaSemana = new Date(now.getTime() - 3 * 60 * 60 * 1000).getUTCDay() === settings.weekly_summary_weekday;
  if (hojeEhDiaDaSemana && settings.last_weekly_summary_sent_on !== today) {
    const semanal = await enviarRelatorio("semanal", now);
    await supabaseAdmin.from("admin_notification_settings").update({ last_weekly_summary_sent_on: today }).eq("id", 1);
    resultado.semanal = semanal;
  }

  const bateRegraMensal =
    settings.monthly_summary_rule === "ultimo_dia"
      ? isUltimoDiaDoMes(now)
      : settings.monthly_summary_rule === "ultima_sexta"
        ? isUltimaOcorrenciaDoDiaSemanaNoMes(now, 5)
        : isUltimaOcorrenciaDoDiaSemanaNoMes(now, 6);

  const mesAtual = today.slice(0, 7);
  const mesDoUltimoEnvio = settings.last_monthly_summary_sent_on?.slice(0, 7);
  if (bateRegraMensal && mesDoUltimoEnvio !== mesAtual) {
    const mensal = await enviarRelatorio("mensal", now);
    await supabaseAdmin.from("admin_notification_settings").update({ last_monthly_summary_sent_on: today }).eq("id", 1);
    resultado.mensal = mensal;
  }

  return NextResponse.json({ ok: true, ...resultado });
}
