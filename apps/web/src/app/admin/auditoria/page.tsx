import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

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
    <div className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/" className="text-sm text-neutral-500 underline">
        ← Voltar
      </Link>
      <h1 className="mt-2 text-lg font-semibold text-neutral-900">Auditoria</h1>
      <p className="mt-1 text-sm text-neutral-500">Últimas 100 ações administrativas e eventos de sistema.</p>

      <div className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
        {(logs ?? []).length === 0 && <p className="p-4 text-sm text-neutral-500">Nenhum registro ainda.</p>}
        {(logs ?? []).map((log) => (
          <div key={log.id} className="p-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-medium text-neutral-900">{log.action}</span>
              <span className="text-xs text-neutral-500">{new Date(log.created_at).toLocaleString("pt-BR")}</span>
            </div>
            <p className="text-xs text-neutral-500">
              {log.actor_id ? actorById.get(log.actor_id) ?? "usuário removido" : "sistema"}
              {log.target_table && ` · ${log.target_table}`}
            </p>
            {log.metadata && Object.keys(log.metadata as object).length > 0 && (
              <pre className="mt-1 overflow-x-auto rounded bg-neutral-50 p-2 text-xs text-neutral-600">
                {JSON.stringify(log.metadata, null, 2)}
              </pre>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
