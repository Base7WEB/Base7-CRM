import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scoreLead } from "@/lib/scoring";
import type { Classificacao } from "@/lib/scoring";
import { AppShell } from "@/components/app-shell";
import { AssignResponsavel } from "./assign-responsavel";
import { ConversationView } from "./conversation-view";
import { StatusSelect } from "./status-select";
import { TagsTasksPanel } from "./tags-tasks-panel";

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

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).single();

  if (!lead) notFound();

  const { data: events } = await supabase
    .from("lead_events")
    .select("type")
    .eq("lead_id", id)
    .in("type", ["FIRST_CONTACT_SENT", "LEAD_REPLIED"]);
  const eventTypes = new Set((events ?? []).map((e) => e.type));

  const { breakdown } = scoreLead({
    telefone: lead.telefone,
    nicho: lead.nicho,
    cidade: lead.cidade,
    instagram: lead.instagram,
    site: lead.site,
    email: lead.email,
    ratingGoogle: lead.rating_google,
    reviewsGoogle: lead.reviews_google,
    hasReplied: eventTypes.has("LEAD_REPLIED"),
    hasFirstContactSent: eventTypes.has("FIRST_CONTACT_SENT"),
  });

  const { data: messages } = await supabase
    .from("messages")
    .select("direction, body, created_at")
    .eq("lead_id", id)
    .order("created_at", { ascending: true })
    .limit(50);

  const { data: tasks } = await supabase
    .from("lead_tasks")
    .select("id, texto, prazo, feita")
    .eq("lead_id", id)
    .order("created_at", { ascending: true });

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

  const classificacao = lead.classificacao as Classificacao;
  const canSend = profile.role === "ADMIN" || lead.responsavel_id === profile.id;

  return (
    <AppShell profile={profile}>
      <Link href="/leads" className="mb-2 inline-block text-sm text-(--muted) hover:text-(--cyan)">
        ← Voltar
      </Link>

      <div className="topbar">
        <div>
          <h1>{lead.empresa}</h1>
          <p>{lead.telefone}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {canSend ? (
            <StatusSelect leadId={lead.id} currentStatus={lead.status} />
          ) : (
            <span className="badge badge-status">{lead.status}</span>
          )}
          <span className={`badge ${CLASSIFICACAO_BADGE[classificacao]}`}>
            {CLASSIFICACAO_LABEL[classificacao]} · {lead.score}/100
          </span>
        </div>
      </div>

      <div className="box">
        <div className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs uppercase text-(--muted)">Contato</p>
            <p className="mt-1">{lead.contato_nome || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-(--muted)">Nicho</p>
            <p className="mt-1">{lead.nicho || "—"}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-(--muted)">Origem</p>
            <p className="mt-1 capitalize">{lead.origem}</p>
          </div>
          <div>
            <p className="text-xs uppercase text-(--muted)">Última interação</p>
            <p className="mt-1">
              {lead.last_interaction_at ? new Date(lead.last_interaction_at).toLocaleString("pt-BR") : "—"}
            </p>
          </div>
        </div>
      </div>

      <div className="box">
        <div className="box-header">
          <h2>Por que essa classificação</h2>
        </div>
        <div className="divide-y divide-(--border)">
          {breakdown.map((item) => (
            <div key={item.criterio} className="flex items-center justify-between py-2 text-sm">
              <div>
                <p>{item.criterio}</p>
                <p className="text-xs text-(--muted)">{item.motivo}</p>
              </div>
              <span className="font-mono text-xs font-semibold text-(--cyan)">
                +{item.pontos}/{item.maximo}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="box">
        <div className="box-header">
          <h2>Responsável</h2>
        </div>
        {profile.role === "ADMIN" ? (
          <AssignResponsavel leadId={lead.id} currentId={lead.responsavel_id} options={consultores} />
        ) : (
          <p className="text-sm">Você</p>
        )}
      </div>

      <TagsTasksPanel leadId={lead.id} initialTags={lead.tags ?? []} initialTasks={tasks ?? []} canEdit={canSend} />

      <div id="conversa" className="scroll-mt-4">
        <ConversationView leadId={lead.id} initialMessages={messages ?? []} canSend={canSend} />
      </div>
    </AppShell>
  );
}
