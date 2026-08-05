import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/app-shell";
import { LeadsTableClient } from "./leads-table-client";

export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ responsavel?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { responsavel: responsavelFiltro } = await searchParams;

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

  const supabase = await createClient();
  let leadsQuery = supabase
    .from("leads")
    .select(
      "id, empresa, nicho, cidade, telefone, site, instagram, status, responsavel_id, responsavel_legado_texto, score, classificacao, created_at"
    )
    .order("score", { ascending: false });

  if (profile.role === "ADMIN" && responsavelFiltro === "sem") {
    leadsQuery = leadsQuery.is("responsavel_id", null);
  } else if (profile.role === "ADMIN" && responsavelFiltro) {
    leadsQuery = leadsQuery.eq("responsavel_id", responsavelFiltro);
  }

  const { data: leads } = await leadsQuery;

  const responsavelIds = [...new Set((leads ?? []).map((l) => l.responsavel_id).filter(Boolean))];
  const { data: responsaveis } =
    responsavelIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", responsavelIds as string[])
      : { data: [] };
  const responsavelById = new Map((responsaveis ?? []).map((r) => [r.id, r.full_name]));

  return (
    <AppShell profile={profile}>
      <div className="topbar">
        <div>
          <h1>{profile.role === "ADMIN" ? "Todos os leads" : "Meus leads"}</h1>
          <p>{leads?.length ?? 0} leads · ordenado por score</p>
        </div>
      </div>

      {profile.role === "ADMIN" && (
        <div className="mb-4 flex flex-wrap gap-1">
          <Link
            href="/leads"
            className={!responsavelFiltro ? "btn-sm bg-(--cyan)/15 text-(--cyan)" : "btn-sm text-(--muted) hover:bg-white/5"}
          >
            Visão geral
          </Link>
          <Link
            href="/leads?responsavel=sem"
            className={responsavelFiltro === "sem" ? "btn-sm bg-(--cyan)/15 text-(--cyan)" : "btn-sm text-(--muted) hover:bg-white/5"}
          >
            Não atribuídos
          </Link>
          {consultores.map((c) => (
            <Link
              key={c.id}
              href={`/leads?responsavel=${c.id}`}
              className={
                responsavelFiltro === c.id ? "btn-sm bg-(--cyan)/15 text-(--cyan)" : "btn-sm text-(--muted) hover:bg-white/5"
              }
            >
              {c.full_name.split(" ")[0]}
            </Link>
          ))}
        </div>
      )}

      <LeadsTableClient
        leads={leads ?? []}
        responsavelById={responsavelById}
        consultores={consultores}
        isAdmin={profile.role === "ADMIN"}
      />
    </AppShell>
  );
}
