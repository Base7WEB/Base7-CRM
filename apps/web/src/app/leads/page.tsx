import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Classificacao } from "@/lib/scoring";
import { AppShell } from "@/components/app-shell";

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

const CLASSIFICACAO_BADGE: Record<Classificacao, string> = {
  QUENTE: "badge-hot",
  QUALIFICADO: "badge-qualified",
  MORNO: "badge-medium",
  FRIO: "badge-cold",
};

const CLASSIFICACAO_LABEL: Record<Classificacao, string> = {
  QUENTE: "🔥 Quente",
  QUALIFICADO: "🟠 Qualificado",
  MORNO: "🟡 Morno",
  FRIO: "🔵 Frio",
};

export default async function LeadsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: leads } = await supabase
    .from("leads")
    .select(
      "id, empresa, nicho, cidade, telefone, site, instagram, status, responsavel_id, responsavel_legado_texto, score, classificacao, created_at"
    )
    .order("score", { ascending: false });

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

      <div className="box">
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Telefone</th>
                <th>Site</th>
                <th>Instagram</th>
                <th>Status</th>
                <th>Classificação</th>
                <th>Responsável</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {(leads ?? []).map((lead) => (
                <tr key={lead.id}>
                  <td>
                    <Link href={`/leads/${lead.id}`} className="font-semibold text-white hover:text-(--cyan)">
                      {lead.empresa}
                    </Link>
                    {(lead.nicho || lead.cidade) && (
                      <p className="text-xs text-(--muted)">
                        {[lead.nicho, lead.cidade].filter(Boolean).join(" · ")}
                      </p>
                    )}
                  </td>
                  <td className="text-(--text)">{lead.telefone}</td>
                  <td>
                    {lead.site ? (
                      <a
                        href={lead.site.startsWith("http") ? lead.site : `https://${lead.site}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-(--cyan) hover:underline"
                        title={lead.site}
                      >
                        ✓
                      </a>
                    ) : (
                      <span className="text-(--muted)">—</span>
                    )}
                  </td>
                  <td>
                    {lead.instagram ? (
                      <a
                        href={
                          lead.instagram.startsWith("http")
                            ? lead.instagram
                            : `https://instagram.com/${lead.instagram.replace(/^@/, "")}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="text-(--cyan) hover:underline"
                        title={lead.instagram}
                      >
                        ✓
                      </a>
                    ) : (
                      <span className="text-(--muted)">—</span>
                    )}
                  </td>
                  <td className="text-(--text)">
                    <span className="badge badge-status">{STATUS_LABEL[lead.status] ?? lead.status}</span>
                  </td>
                  <td>
                    <span className={`badge ${CLASSIFICACAO_BADGE[lead.classificacao as Classificacao]}`}>
                      {CLASSIFICACAO_LABEL[lead.classificacao as Classificacao]} · {lead.score}
                    </span>
                  </td>
                  <td className="text-(--text)">
                    {lead.responsavel_id
                      ? responsavelById.get(lead.responsavel_id) ?? "—"
                      : lead.responsavel_legado_texto || "Não atribuído"}
                  </td>
                  <td>
                    {lead.telefone && (
                      <Link
                        href={`/leads/${lead.id}#conversa`}
                        title="Abrir conversa no WhatsApp"
                        className="inline-flex h-7 w-7 items-center justify-center rounded-md text-(--success) hover:bg-white/5"
                      >
                        💬
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {(leads ?? []).length === 0 && <p className="empty">Nenhum lead ainda.</p>}
        </div>
      </div>
    </AppShell>
  );
}
