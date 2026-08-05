import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeDashboardMetrics, type Period } from "@/lib/dashboard";
import type { DashboardMetrics } from "@/lib/dashboard";
import { AppShell } from "@/components/app-shell";
import type { Classificacao } from "@/lib/scoring";

const PERIOD_LABEL: Record<Period, string> = {
  hoje: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  tudo: "Tudo",
};

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

const CLASSIFICACAO_ORDER: Classificacao[] = ["QUENTE", "QUALIFICADO", "MORNO", "FRIO"];
const CLASSIFICACAO_LABEL: Record<Classificacao, string> = {
  QUENTE: "🔥 Quente",
  QUALIFICADO: "🟠 Qualificado",
  MORNO: "🟡 Morno",
  FRIO: "🔵 Frio",
};
const CLASSIFICACAO_BAR: Record<Classificacao, string> = {
  QUENTE: "linear-gradient(90deg, #ef4444, #f87171)",
  QUALIFICADO: "linear-gradient(90deg, #f59e0b, #fbbf24)",
  MORNO: "linear-gradient(90deg, #2563eb, #60a5fa)",
  FRIO: "linear-gradient(90deg, #475569, #94a3b8)",
};

function pct(n: number | null): string {
  if (n === null) return "—";
  return `${Math.round(n * 100)}%`;
}

function StatCard({
  icon,
  colorClass,
  label,
  value,
}: {
  icon: string;
  colorClass: string;
  label: string;
  value: string | number;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${colorClass}`} aria-hidden>
        {icon}
      </div>
      <div className="stat-body">
        <p className="stat-num">{value}</p>
        <p className="stat-label">{label}</p>
      </div>
    </div>
  );
}

function MetricsSection({ metrics }: { metrics: DashboardMetrics }) {
  const maxStatus = Math.max(1, ...Object.values(metrics.porStatus));
  const maxClassificacao = Math.max(1, ...Object.values(metrics.porClassificacao));

  return (
    <div>
      <div className="stats-grid">
        <StatCard icon="🧾" colorClass="si-blue" label="Leads" value={metrics.totalLeads} />
        <StatCard icon="📤" colorClass="si-cyan" label="Contatos realizados" value={metrics.contatosRealizados} />
        <StatCard icon="📩" colorClass="si-purple" label="Respostas" value={metrics.respostas} />
        <StatCard icon="📈" colorClass="si-cyan" label="Taxa de resposta" value={pct(metrics.taxaResposta)} />
        <StatCard icon="🤝" colorClass="si-green" label="Vendas" value={metrics.vendas} />
        <StatCard icon="✖️" colorClass="si-rose" label="Perdidos" value={metrics.perdidos} />
        <StatCard icon="🎯" colorClass="si-green" label="Taxa de fechamento" value={pct(metrics.taxaFechamento)} />
        <StatCard icon="⚠️" colorClass="si-yellow" label="Leads parados" value={metrics.leadsParados.length} />
      </div>

      <div className="stats-grid !grid-cols-2">
        <StatCard icon="📨" colorClass="si-cyan" label="Mensagens enviadas" value={metrics.mensagensEnviadas} />
        <StatCard icon="📬" colorClass="si-purple" label="Mensagens recebidas" value={metrics.mensagensRecebidas} />
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <div className="box">
          <div className="box-header">
            <h2>Funil</h2>
          </div>
          {STATUS_ORDER.filter((s) => metrics.porStatus[s]).map((status) => (
            <div key={status} className="funil-row">
              <span className="funil-label">{STATUS_LABEL[status]}</span>
              <div className="funil-bar-wrap">
                <div
                  className="funil-bar"
                  style={{ width: `${((metrics.porStatus[status] ?? 0) / maxStatus) * 100}%` }}
                />
              </div>
              <span className="funil-count">{metrics.porStatus[status] ?? 0}</span>
            </div>
          ))}
          {metrics.totalLeads === 0 && <p className="empty">Sem leads ainda.</p>}
        </div>

        <div className="box">
          <div className="box-header">
            <h2>Classificação</h2>
          </div>
          {CLASSIFICACAO_ORDER.map((c) => (
            <div key={c} className="funil-row">
              <span className="funil-label">{CLASSIFICACAO_LABEL[c]}</span>
              <div className="funil-bar-wrap">
                <div
                  className="funil-bar"
                  style={{
                    width: `${((metrics.porClassificacao[c] ?? 0) / maxClassificacao) * 100}%`,
                    background: CLASSIFICACAO_BAR[c],
                  }}
                />
              </div>
              <span className="funil-count">{metrics.porClassificacao[c] ?? 0}</span>
            </div>
          ))}
          {metrics.totalLeads === 0 && <p className="empty">Sem leads ainda.</p>}
        </div>
      </div>

      {metrics.leadsRecentes.length > 0 && (
        <div className="box">
          <div className="box-header">
            <h2>Leads recentes</h2>
          </div>
          {metrics.leadsRecentes.map((lead) => (
            <Link key={lead.id} href={`/leads/${lead.id}`} className="recente-item hover:text-(--cyan)">
              <span className="text-sm font-medium">{lead.empresa}</span>
              <span className="text-xs text-(--muted)">
                {STATUS_LABEL[lead.status] ?? lead.status} · {new Date(lead.created_at).toLocaleDateString("pt-BR")}
              </span>
            </Link>
          ))}
        </div>
      )}

      {metrics.leadsParados.length > 0 && (
        <div className="box border-(--warn)/30">
          <div className="box-header">
            <h2>⚠️ Leads sem acompanhamento</h2>
          </div>
          <div className="divide-y divide-(--border)">
            {metrics.leadsParados.map((lp) => (
              <Link
                key={lp.lead_id}
                href={`/leads/${lp.lead_id}`}
                className="flex items-center justify-between py-2.5 text-sm transition hover:text-(--cyan)"
              >
                <span className="font-medium">{lp.empresa}</span>
                <span className="text-xs text-(--muted)">
                  {lp.motivo === "aguardando_resposta_consultor" ? "aguardando você" : "sem resposta do lead"} ·{" "}
                  {new Date(lp.ultima_mensagem_em).toLocaleDateString("pt-BR")}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ period?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { period: periodParam } = await searchParams;
  const period: Period = (["hoje", "7d", "30d", "tudo"] as const).includes(periodParam as Period)
    ? (periodParam as Period)
    : "30d";

  const supabase = await createClient();

  const metrics = await computeDashboardMetrics(supabase, {
    responsavelId: profile.role === "ADMIN" ? undefined : profile.id,
    period,
  });

  let ranking: { id: string; full_name: string; metrics: DashboardMetrics }[] = [];
  if (profile.role === "ADMIN") {
    const supabaseAdmin = createAdminClient();
    const { data: consultores } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("role", "CONSULTOR_COMERCIAL")
      .eq("is_active", true)
      .order("full_name");

    ranking = await Promise.all(
      (consultores ?? []).map(async (c) => ({
        id: c.id,
        full_name: c.full_name,
        metrics: await computeDashboardMetrics(supabase, { responsavelId: c.id, period }),
      }))
    );
  }

  return (
    <AppShell profile={profile}>
      <div className="topbar">
        <div>
          <h1>{profile.role === "ADMIN" ? "Operação geral" : "Meu desempenho"}</h1>
          <p>Bem-vindo(a), {profile.full_name.split(" ")[0]}.</p>
        </div>
        <div className="flex gap-1">
          {(["hoje", "7d", "30d", "tudo"] as const).map((p) => (
            <Link
              key={p}
              href={`/?period=${p}`}
              className={p === period ? "btn-sm bg-(--cyan)/15 text-(--cyan)" : "btn-sm text-(--muted) hover:bg-white/5"}
            >
              {PERIOD_LABEL[p]}
            </Link>
          ))}
        </div>
      </div>

      <MetricsSection metrics={metrics} />

      {profile.role === "ADMIN" && ranking.length > 0 && (
        <div className="box">
          <div className="box-header">
            <h2>Desempenho por consultor</h2>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Consultor</th>
                  <th>Leads</th>
                  <th>Contatos</th>
                  <th>Respostas</th>
                  <th>Taxa resp.</th>
                  <th>Vendas</th>
                  <th>Parados</th>
                </tr>
              </thead>
              <tbody>
                {ranking.map((r) => (
                  <tr key={r.id}>
                    <td className="font-semibold text-white">{r.full_name}</td>
                    <td>{r.metrics.totalLeads}</td>
                    <td>{r.metrics.contatosRealizados}</td>
                    <td>{r.metrics.respostas}</td>
                    <td>{pct(r.metrics.taxaResposta)}</td>
                    <td>{r.metrics.vendas}</td>
                    <td>{r.metrics.leadsParados.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {profile.role === "ADMIN" && ranking.length === 0 && (
        <div className="box">
          <p className="empty">Nenhum consultor ativo ainda. Convide alguém em Consultores.</p>
        </div>
      )}
    </AppShell>
  );
}
