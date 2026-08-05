import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";
import { formatAuditLog, CATEGORY_BADGE, CATEGORY_LABEL, CATEGORY_FILTERS } from "@/lib/audit-format";

export default async function AuditoriaPage({
  searchParams,
}: {
  searchParams: Promise<{ categoria?: string }>;
}) {
  let profile;
  try {
    profile = await requireAdmin();
  } catch {
    redirect("/");
  }

  const { categoria: categoriaParam } = await searchParams;
  const filtro = CATEGORY_FILTERS.find((f) => f.value === categoriaParam) ?? null;

  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, action, target_table, target_id, metadata, created_at, actor_id")
    .order("created_at", { ascending: false })
    .limit(300);

  const profileIds = new Set<string>();
  for (const log of logs ?? []) {
    if (log.actor_id) profileIds.add(log.actor_id);
    if (log.target_table === "profiles" && log.target_id) profileIds.add(log.target_id);
  }
  const { data: people } =
    profileIds.size > 0 ? await supabase.from("profiles").select("id, full_name").in("id", [...profileIds]) : { data: [] };
  const nameById = new Map((people ?? []).map((p) => [p.id, p.full_name]));

  const formatted = (logs ?? []).map((log) => {
    const actorName = log.actor_id ? nameById.get(log.actor_id) ?? "Alguém" : "Sistema";
    const targetName = log.target_table === "profiles" && log.target_id ? nameById.get(log.target_id) ?? null : null;
    return { log, ...formatAuditLog(log, { actorName, targetName }) };
  });

  const visiveis = (filtro ? formatted.filter((f) => filtro.categorias.includes(f.categoria)) : formatted).slice(0, 100);

  return (
    <AppShell profile={profile}>
      <div className="topbar">
        <div>
          <h1>Auditoria</h1>
          <p>Últimas ações administrativas e eventos de sistema.</p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap gap-1">
        <Link
          href="/admin/auditoria"
          className={!filtro ? "btn-sm bg-(--cyan)/15 text-(--cyan)" : "btn-sm text-(--muted) hover:bg-white/5"}
        >
          Todos
        </Link>
        {CATEGORY_FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/admin/auditoria?categoria=${f.value}`}
            className={filtro?.value === f.value ? "btn-sm bg-(--cyan)/15 text-(--cyan)" : "btn-sm text-(--muted) hover:bg-white/5"}
          >
            {f.label}
          </Link>
        ))}
      </div>

      <div className="box">
        {visiveis.length === 0 && <p className="empty">Nenhum registro encontrado.</p>}
        <div className="divide-y divide-(--border)">
          {visiveis.map(({ log, texto, categoria }) => (
            <div key={log.id} className="flex items-start justify-between gap-4 py-3 text-sm">
              <div className="flex items-start gap-3">
                <span className={`badge mt-0.5 shrink-0 ${CATEGORY_BADGE[categoria]}`}>{CATEGORY_LABEL[categoria]}</span>
                <p>{texto}</p>
              </div>
              <span className="shrink-0 text-xs text-(--muted)">
                {new Date(log.created_at).toLocaleString("pt-BR")}
              </span>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
