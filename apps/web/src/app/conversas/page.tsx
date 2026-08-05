import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/app-shell";
import type { Classificacao } from "@/lib/scoring";

const CLASSIFICACAO_BADGE: Record<Classificacao, string> = {
  QUENTE: "badge-hot",
  QUALIFICADO: "badge-qualified",
  MORNO: "badge-medium",
  FRIO: "badge-cold",
};

export default async function ConversasPage({
  searchParams,
}: {
  searchParams: Promise<{ consultor?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { consultor: consultorFiltro } = await searchParams;
  const supabase = await createClient();

  let query = supabase
    .from("conversas_recentes")
    .select("*")
    .order("ultima_mensagem_em", { ascending: false })
    .limit(200);

  if (profile.role === "ADMIN" && consultorFiltro) {
    query = query.eq("responsavel_id", consultorFiltro);
  }

  const { data: conversas } = await query;

  let consultores: { id: string; full_name: string }[] = [];
  if (profile.role === "ADMIN") {
    const supabaseAdmin = createAdminClient();
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("is_active", true)
      .order("full_name");
    consultores = data ?? [];
  }
  const responsavelById = new Map(consultores.map((c) => [c.id, c.full_name]));

  return (
    <AppShell profile={profile}>
      <div className="topbar">
        <div>
          <h1>Central de Conversas</h1>
          <p>{profile.role === "ADMIN" ? "Todas as conversas da equipe" : "Suas conversas"}, mais recentes primeiro.</p>
        </div>
        {profile.role === "ADMIN" && consultores.length > 0 && (
          <div className="flex gap-1">
            <Link
              href="/conversas"
              className={!consultorFiltro ? "btn-sm bg-(--cyan)/15 text-(--cyan)" : "btn-sm text-(--muted) hover:bg-white/5"}
            >
              Todos
            </Link>
            {consultores.map((c) => (
              <Link
                key={c.id}
                href={`/conversas?consultor=${c.id}`}
                className={
                  consultorFiltro === c.id ? "btn-sm bg-(--cyan)/15 text-(--cyan)" : "btn-sm text-(--muted) hover:bg-white/5"
                }
              >
                {c.full_name.split(" ")[0]}
              </Link>
            ))}
          </div>
        )}
      </div>

      <div className="box">
        {(conversas ?? []).length === 0 ? (
          <p className="empty">Nenhuma conversa ainda.</p>
        ) : (
          <div className="divide-y divide-(--border)">
            {(conversas ?? []).map((c) => (
              <Link
                key={c.lead_id}
                href={`/leads/${c.lead_id}`}
                className="flex items-center justify-between gap-4 py-3 transition hover:bg-white/[0.02]"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-semibold text-white">{c.empresa}</p>
                    <span className={`badge shrink-0 ${CLASSIFICACAO_BADGE[c.classificacao as Classificacao]}`}>
                      {c.classificacao}
                    </span>
                  </div>
                  <p className="mt-1 truncate text-sm text-(--muted)">
                    {c.ultima_direcao === "OUT" ? "Você: " : ""}
                    {c.ultima_mensagem}
                  </p>
                </div>
                <div className="shrink-0 text-right text-xs text-(--muted)">
                  {profile.role === "ADMIN" && c.responsavel_id && (
                    <p className="mb-1 font-medium text-(--cyan)">{responsavelById.get(c.responsavel_id) ?? "—"}</p>
                  )}
                  <p>{new Date(c.ultima_mensagem_em!).toLocaleString("pt-BR")}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
