import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/app-shell";
import { ConfiguracoesClient } from "./configuracoes-client";
import { ALERT_BADGE, ALERT_LABEL, ALERT_FILTERS, formatAlert, type AlertType } from "@/lib/alert-format";

export default async function ConfiguracoesPage({
  searchParams,
}: {
  searchParams: Promise<{ tipo?: string }>;
}) {
  let profile;
  try {
    profile = await requireAdmin();
  } catch {
    redirect("/");
  }

  const { tipo: tipoFiltro } = await searchParams;
  const supabaseAdmin = createAdminClient();

  const { data: settings } = await supabaseAdmin.from("admin_notification_settings").select("*").eq("id", 1).single();

  let alertsQuery = supabaseAdmin
    .from("admin_alert_queue")
    .select("id, type, payload, notified, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  if (tipoFiltro) alertsQuery = alertsQuery.eq("type", tipoFiltro);
  const { data: alerts } = await alertsQuery;

  const { count: pendentes } = await supabaseAdmin
    .from("admin_alert_queue")
    .select("id", { count: "exact", head: true })
    .eq("notified", false);

  return (
    <AppShell profile={profile}>
      <div className="topbar">
        <div>
          <h1>Notificações do admin</h1>
          <p>
            Alertas (venda fechada, lead quente, WhatsApp desconectado) e resumos vão pro grupo configurado abaixo,
            agrupados — nunca um por evento.
          </p>
        </div>
      </div>

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon si-yellow">⏳</div>
          <div className="stat-body">
            <p className="stat-num">{pendentes ?? 0}</p>
            <p className="stat-label">Alertas pendentes de envio</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon si-cyan">📊</div>
          <div className="stat-body">
            <p className="stat-num">
              {settings?.last_digest_sent_at ? new Date(settings.last_digest_sent_at).toLocaleString("pt-BR") : "—"}
            </p>
            <p className="stat-label">Último resumo agrupado</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon si-green">📈</div>
          <div className="stat-body">
            <p className="stat-num">
              {settings?.last_daily_summary_sent_on
                ? new Date(settings.last_daily_summary_sent_on + "T00:00:00").toLocaleDateString("pt-BR")
                : "—"}
            </p>
            <p className="stat-label">Último relatório diário</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon si-purple">📆</div>
          <div className="stat-body">
            <p className="stat-num">
              {settings?.last_weekly_summary_sent_on
                ? new Date(settings.last_weekly_summary_sent_on + "T00:00:00").toLocaleDateString("pt-BR")
                : "—"}
            </p>
            <p className="stat-label">Último relatório semanal</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon si-blue">🗓️</div>
          <div className="stat-body">
            <p className="stat-num">
              {settings?.last_monthly_summary_sent_on
                ? new Date(settings.last_monthly_summary_sent_on + "T00:00:00").toLocaleDateString("pt-BR")
                : "—"}
            </p>
            <p className="stat-label">Último relatório mensal</p>
          </div>
        </div>
      </div>

      <ConfiguracoesClient />

      <div className="box">
        <div className="box-header">
          <h2>Histórico de alertas</h2>
        </div>
        <div className="mb-3 flex flex-wrap gap-1">
          <Link
            href="/admin/configuracoes"
            className={!tipoFiltro ? "btn-sm bg-(--cyan)/15 text-(--cyan)" : "btn-sm text-(--muted) hover:bg-white/5"}
          >
            Todos
          </Link>
          {ALERT_FILTERS.map((f) => (
            <Link
              key={f.value}
              href={`/admin/configuracoes?tipo=${f.value}`}
              className={tipoFiltro === f.value ? "btn-sm bg-(--cyan)/15 text-(--cyan)" : "btn-sm text-(--muted) hover:bg-white/5"}
            >
              {f.label}
            </Link>
          ))}
        </div>

        {(alerts ?? []).length === 0 ? (
          <p className="empty">Nenhum alerta ainda.</p>
        ) : (
          <div className="divide-y divide-(--border)">
            {(alerts ?? []).map((alert) => (
              <div key={alert.id} className="flex items-center justify-between gap-4 py-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className={`badge shrink-0 ${ALERT_BADGE[alert.type as AlertType] ?? "badge-status"}`}>
                    {ALERT_LABEL[alert.type as AlertType] ?? alert.type}
                  </span>
                  <p>{formatAlert(alert)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span className={alert.notified ? "badge badge-success" : "badge badge-medium"}>
                    {alert.notified ? "enviado" : "aguardando"}
                  </span>
                  <span className="text-xs text-(--muted)">{new Date(alert.created_at).toLocaleString("pt-BR")}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
