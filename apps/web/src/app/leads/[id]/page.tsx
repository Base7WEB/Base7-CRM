import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scoreLead } from "@/lib/scoring";
import type { Classificacao } from "@/lib/scoring";
import { AssignResponsavel } from "./assign-responsavel";
import { ConversationView } from "./conversation-view";
import { StatusSelect } from "./status-select";

const CLASSIFICACAO_BADGE: Record<Classificacao, string> = {
  QUENTE: "bg-red-100 text-red-800 border-red-300",
  QUALIFICADO: "bg-orange-100 text-orange-800 border-orange-300",
  MORNO: "bg-yellow-100 text-yellow-800 border-yellow-300",
  FRIO: "bg-blue-100 text-blue-800 border-blue-300",
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
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/leads" className="text-sm text-neutral-500 underline">
        ← Voltar
      </Link>

      <div className="mt-2 flex items-start justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">{lead.empresa}</h1>
          <p className="text-sm text-neutral-500">{lead.telefone}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {canSend ? (
            <StatusSelect leadId={lead.id} currentStatus={lead.status} />
          ) : (
            <span className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700">
              {lead.status}
            </span>
          )}
          <span className={`rounded-full border px-3 py-1 text-xs font-medium ${CLASSIFICACAO_BADGE[classificacao]}`}>
            {CLASSIFICACAO_LABEL[classificacao]} · {lead.score}/100
          </span>
        </div>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-lg border border-neutral-200 p-4 text-sm">
        <div>
          <dt className="text-neutral-500">Contato</dt>
          <dd className="text-neutral-900">{lead.contato_nome || "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Nicho</dt>
          <dd className="text-neutral-900">{lead.nicho || "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Origem</dt>
          <dd className="text-neutral-900">{lead.origem}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Última interação</dt>
          <dd className="text-neutral-900">
            {lead.last_interaction_at ? new Date(lead.last_interaction_at).toLocaleString("pt-BR") : "—"}
          </dd>
        </div>
      </dl>

      <div className="mt-4 rounded-lg border border-neutral-200 p-4">
        <p className="text-xs font-medium uppercase text-neutral-500">Por que essa classificação</p>
        <div className="mt-2 divide-y divide-neutral-100">
          {breakdown.map((item) => (
            <div key={item.criterio} className="flex items-center justify-between py-1.5 text-sm">
              <div>
                <p className="text-neutral-900">{item.criterio}</p>
                <p className="text-xs text-neutral-500">{item.motivo}</p>
              </div>
              <span className="text-xs font-medium text-neutral-700">
                +{item.pontos}/{item.maximo}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 rounded-lg border border-neutral-200 p-4">
        <p className="text-xs font-medium uppercase text-neutral-500">Responsável</p>
        {profile.role === "ADMIN" ? (
          <div className="mt-2">
            <AssignResponsavel leadId={lead.id} currentId={lead.responsavel_id} options={consultores} />
          </div>
        ) : (
          <p className="mt-1 text-sm text-neutral-900">Você</p>
        )}
      </div>

      <ConversationView leadId={lead.id} initialMessages={messages ?? []} canSend={canSend} />
    </div>
  );
}
