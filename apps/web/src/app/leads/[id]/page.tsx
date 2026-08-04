import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AssignResponsavel } from "./assign-responsavel";

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
        <span className="rounded-full border border-neutral-300 px-3 py-1 text-xs font-medium text-neutral-700">
          {lead.status}
        </span>
      </div>

      <dl className="mt-6 grid grid-cols-2 gap-4 rounded-lg border border-neutral-200 p-4 text-sm">
        <div>
          <dt className="text-neutral-500">Contato</dt>
          <dd className="text-neutral-900">{lead.contato_nome || "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Origem</dt>
          <dd className="text-neutral-900">{lead.origem}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Temperatura</dt>
          <dd className="text-neutral-900">{lead.temperatura ?? "—"}</dd>
        </div>
        <div>
          <dt className="text-neutral-500">Última interação</dt>
          <dd className="text-neutral-900">
            {lead.last_interaction_at ? new Date(lead.last_interaction_at).toLocaleString("pt-BR") : "—"}
          </dd>
        </div>
      </dl>

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
    </div>
  );
}
