import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

export default async function AuditoriaPage() {
  let profile;
  try {
    profile = await requireAdmin();
  } catch {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: logs } = await supabase
    .from("audit_logs")
    .select("id, action, target_table, target_id, metadata, created_at, actor_id")
    .order("created_at", { ascending: false })
    .limit(100);

  const actorIds = [...new Set((logs ?? []).map((l) => l.actor_id).filter(Boolean))];
  const { data: actors } =
    actorIds.length > 0 ? await supabase.from("profiles").select("id, full_name").in("id", actorIds as string[]) : { data: [] };
  const actorById = new Map((actors ?? []).map((a) => [a.id, a.full_name]));

  return (
    <AppShell profile={profile}>
      <div className="topbar">
        <div>
          <h1>Auditoria</h1>
          <p>Últimas 100 ações administrativas e eventos de sistema.</p>
        </div>
      </div>

      <div className="box">
        {(logs ?? []).length === 0 && <p className="empty">Nenhum registro ainda.</p>}
        <div className="divide-y divide-(--border)">
          {(logs ?? []).map((log) => (
            <div key={log.id} className="py-3 text-sm first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-3">
                <span className="font-semibold text-white">{log.action}</span>
                <span className="shrink-0 text-xs text-(--muted)">
                  {new Date(log.created_at).toLocaleString("pt-BR")}
                </span>
              </div>
              <p className="text-xs text-(--muted)">
                {log.actor_id ? actorById.get(log.actor_id) ?? "usuário removido" : "sistema"}
                {log.target_table && ` · ${log.target_table}`}
              </p>
              {log.metadata && Object.keys(log.metadata as object).length > 0 && (
                <pre className="mt-1.5 overflow-x-auto rounded-lg bg-black/30 p-2 text-xs text-(--text)">
                  {JSON.stringify(log.metadata, null, 2)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
