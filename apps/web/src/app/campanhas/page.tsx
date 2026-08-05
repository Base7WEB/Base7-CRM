import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { AppShell } from "@/components/app-shell";

const STATUS_CAMPANHA_BADGE: Record<string, string> = {
  RASCUNHO: "badge-status",
  EM_EXECUCAO: "badge-success",
  PAUSADA: "badge-medium",
  FINALIZADA: "badge-cold",
  CANCELADA: "badge-hot",
};

export default async function CampanhasConsultorPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  // Admin já tem a tela completa em /admin/campanhas (criar/iniciar/pausar).
  if (profile.role === "ADMIN") redirect("/admin/campanhas");

  const supabase = await createClient();

  // Campanhas "gerais" (responsavel_id null) aparecem pra todo mundo; uma
  // campanha de um consultor específico só aparece pra ele mesmo.
  const { data: campaigns } = await supabase
    .from("campaigns")
    .select("*")
    .or(`responsavel_id.is.null,responsavel_id.eq.${profile.id}`)
    .order("created_at", { ascending: false });

  const results = await Promise.all(
    (campaigns ?? []).map(async (c) => {
      // RLS já restringe campaign_leads às linhas dos próprios leads --
      // essa contagem é "quantos dos MEUS leads estão nesta campanha".
      const { data: leads } = await supabase.from("campaign_leads").select("status").eq("campaign_id", c.id);
      const counts = { total: leads?.length ?? 0, enviado: 0, falhou: 0, pendente: 0 };
      for (const l of leads ?? []) {
        if (l.status === "ENVIADO") counts.enviado++;
        else if (l.status === "FALHOU") counts.falhou++;
        else counts.pendente++;
      }
      return { ...c, counts };
    })
  );

  return (
    <AppShell profile={profile}>
      <div className="topbar">
        <div>
          <h1>Campanhas</h1>
          <p>Acompanhamento das campanhas em andamento — só o admin cria e controla o envio.</p>
        </div>
      </div>

      <div className="box">
        {results.length === 0 ? (
          <p className="empty">Nenhuma campanha ainda.</p>
        ) : (
          <div className="divide-y divide-(--border)">
            {results.map((c) => (
              <Link
                key={c.id}
                href={`/campanhas/${c.id}`}
                className="flex items-center justify-between gap-3 py-4 first:pt-0 last:pb-0 hover:text-(--cyan)"
              >
                <div>
                  <p className="font-semibold text-white">{c.nome}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-(--muted)">
                    <span className={`badge ${STATUS_CAMPANHA_BADGE[c.status] ?? "badge-status"}`}>{c.status}</span>
                    <span className="badge badge-status">{c.responsavel_id ? "👤 Sua campanha" : "🌐 Geral"}</span>
                    {c.counts.total} lead(s) seu(s) · {c.counts.enviado} enviados · {c.counts.falhou} falharam ·{" "}
                    {c.counts.pendente} pendentes
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </AppShell>
  );
}
