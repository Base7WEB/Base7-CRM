import Link from "next/link";
import { redirect, notFound } from "next/navigation";
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

const LEAD_STATUS_BADGE: Record<string, string> = {
  PENDENTE: "badge-status",
  ENFILEIRADO: "badge-medium",
  ENVIADO: "badge-success",
  FALHOU: "badge-hot",
  PULADO: "badge-cold",
};

export default async function CampanhaConsultorDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  if (profile.role === "ADMIN") redirect(`/admin/campanhas/${(await params).id}`);

  const { id } = await params;
  const supabase = await createClient();

  const { data: campaign } = await supabase.from("campaigns").select("*").eq("id", id).single();
  if (!campaign) notFound();

  const { data: followups } = await supabase
    .from("campaign_followups")
    .select("*")
    .eq("campaign_id", id)
    .order("ordem", { ascending: true });

  // RLS já restringe a linhas dos próprios leads.
  const { data: meusLeads } = await supabase
    .from("campaign_leads")
    .select("id, status, updated_at, lead_id, leads(id, empresa, telefone, status)")
    .eq("campaign_id", id)
    .order("updated_at", { ascending: false });

  return (
    <AppShell profile={profile}>
      <Link href="/campanhas" className="mb-2 inline-block text-sm text-(--muted) hover:text-(--cyan)">
        ← Voltar
      </Link>

      <div className="topbar">
        <div>
          <h1>{campaign.nome}</h1>
          <p>{campaign.descricao || "Sem descrição."}</p>
        </div>
        <span className={`badge ${STATUS_CAMPANHA_BADGE[campaign.status] ?? "badge-status"}`}>{campaign.status}</span>
      </div>

      <div className="box">
        <p className="text-xs uppercase text-(--muted)">Mensagem</p>
        <p className="mt-1 whitespace-pre-wrap text-sm">{campaign.corpo_mensagem}</p>
      </div>

      {followups && followups.length > 0 && (
        <div className="box">
          <div className="box-header">
            <h2>Follow-ups automáticos</h2>
          </div>
          <div className="divide-y divide-(--border)">
            {followups.map((f) => (
              <div key={f.id} className="py-2 text-sm">
                <p className="text-xs uppercase text-(--muted)">Após {f.dias} dia(s) sem resposta</p>
                <p className="mt-1 whitespace-pre-wrap">{f.texto}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="box">
        <div className="box-header">
          <h2>Seus leads nesta campanha ({meusLeads?.length ?? 0})</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Telefone</th>
                <th>Status na fila</th>
                <th>Status do lead</th>
              </tr>
            </thead>
            <tbody>
              {(meusLeads ?? []).map((cl) => {
                const lead = cl.leads as unknown as { id: string; empresa: string; telefone: string; status: string } | null;
                return (
                  <tr key={cl.id}>
                    <td>
                      {lead ? (
                        <Link href={`/leads/${lead.id}`} className="font-semibold text-white hover:text-(--cyan)">
                          {lead.empresa}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="text-(--text)">{lead?.telefone ?? "—"}</td>
                    <td>
                      <span className={`badge ${LEAD_STATUS_BADGE[cl.status] ?? "badge-status"}`}>{cl.status}</span>
                    </td>
                    <td className="text-(--text)">{lead?.status ?? "—"}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {(meusLeads ?? []).length === 0 && <p className="empty">Nenhum lead seu nesta campanha.</p>}
        </div>
      </div>
    </AppShell>
  );
}
