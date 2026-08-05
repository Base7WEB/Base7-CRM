import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { signOut } from "@/app/login/actions";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeDashboardMetrics, type Period } from "@/lib/dashboard";
import type { DashboardMetrics } from "@/lib/dashboard";

const PERIOD_LABEL: Record<Period, string> = {
  hoje: "Hoje",
  "7d": "7 dias",
  "30d": "30 dias",
  tudo: "Tudo",
};

function pct(n: number | null): string {
  if (n === null) return "sem dados";
  return `${Math.round(n * 100)}%`;
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-neutral-200 p-4">
      <p className="text-xs font-medium uppercase text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-neutral-900">{value}</p>
    </div>
  );
}

function MetricsSection({ metrics, title }: { metrics: DashboardMetrics; title?: string }) {
  return (
    <div>
      {title && <h2 className="mb-3 text-sm font-semibold text-neutral-700">{title}</h2>}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MetricCard label="Leads" value={metrics.totalLeads} />
        <MetricCard label="Contatos realizados" value={metrics.contatosRealizados} />
        <MetricCard label="Respostas" value={metrics.respostas} />
        <MetricCard label="Taxa de resposta" value={pct(metrics.taxaResposta)} />
        <MetricCard label="Vendas" value={metrics.vendas} />
        <MetricCard label="Perdidos" value={metrics.perdidos} />
        <MetricCard label="Taxa de fechamento" value={pct(metrics.taxaFechamento)} />
        <MetricCard label="Leads parados" value={metrics.leadsParados.length} />
      </div>

      {metrics.leadsParados.length > 0 && (
        <div className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-4">
          <p className="text-xs font-medium uppercase text-amber-800">⚠️ Leads sem acompanhamento</p>
          <div className="mt-2 divide-y divide-amber-200">
            {metrics.leadsParados.map((lp) => (
              <Link
                key={lp.lead_id}
                href={`/leads/${lp.lead_id}`}
                className="flex items-center justify-between py-1.5 text-sm hover:underline"
              >
                <span className="text-neutral-900">{lp.empresa}</span>
                <span className="text-xs text-amber-800">
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
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">BASE7 CRM</h1>
          <p className="text-sm text-neutral-500">
            {profile.full_name} · {profile.role === "ADMIN" ? "Administrador" : "Consultor comercial"}
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Sair
          </button>
        </form>
      </div>

      <div className="mt-6 flex gap-3">
        <Link
          href="/leads"
          className="rounded-lg border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
        >
          {profile.role === "ADMIN" ? "Todos os leads" : "Meus leads"}
        </Link>
        {profile.role === "ADMIN" && (
          <Link
            href="/admin/usuarios"
            className="rounded-lg border border-neutral-200 px-4 py-3 text-sm font-medium text-neutral-900 hover:bg-neutral-50"
          >
            Gerenciar consultores
          </Link>
        )}
      </div>

      <div className="mt-8 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-neutral-700">
          {profile.role === "ADMIN" ? "Operação geral" : "Meu desempenho"}
        </h2>
        <div className="flex gap-1">
          {(["hoje", "7d", "30d", "tudo"] as const).map((p) => (
            <Link
              key={p}
              href={`/?period=${p}`}
              className={`rounded-md px-2.5 py-1 text-xs font-medium ${
                p === period ? "bg-neutral-900 text-white" : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {PERIOD_LABEL[p]}
            </Link>
          ))}
        </div>
      </div>

      <div className="mt-3">
        <MetricsSection metrics={metrics} />
      </div>

      {profile.role === "ADMIN" && ranking.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-3 text-sm font-semibold text-neutral-700">Desempenho por consultor</h2>
          <div className="overflow-x-auto rounded-lg border border-neutral-200">
            <table className="w-full text-sm">
              <thead className="bg-neutral-50 text-left text-xs font-medium uppercase text-neutral-500">
                <tr>
                  <th className="px-4 py-2">Consultor</th>
                  <th className="px-4 py-2">Leads</th>
                  <th className="px-4 py-2">Contatos</th>
                  <th className="px-4 py-2">Respostas</th>
                  <th className="px-4 py-2">Taxa resp.</th>
                  <th className="px-4 py-2">Vendas</th>
                  <th className="px-4 py-2">Parados</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-200">
                {ranking.map((r) => (
                  <tr key={r.id}>
                    <td className="px-4 py-2 font-medium text-neutral-900">{r.full_name}</td>
                    <td className="px-4 py-2 text-neutral-600">{r.metrics.totalLeads}</td>
                    <td className="px-4 py-2 text-neutral-600">{r.metrics.contatosRealizados}</td>
                    <td className="px-4 py-2 text-neutral-600">{r.metrics.respostas}</td>
                    <td className="px-4 py-2 text-neutral-600">{pct(r.metrics.taxaResposta)}</td>
                    <td className="px-4 py-2 text-neutral-600">{r.metrics.vendas}</td>
                    <td className="px-4 py-2 text-neutral-600">{r.metrics.leadsParados.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
