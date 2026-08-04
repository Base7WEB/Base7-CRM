import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import type { Classificacao } from "@/lib/scoring";

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
    .select("id, empresa, telefone, status, responsavel_id, responsavel_legado_texto, score, classificacao, created_at")
    .order("score", { ascending: false });

  const responsavelIds = [...new Set((leads ?? []).map((l) => l.responsavel_id).filter(Boolean))];
  const { data: responsaveis } =
    responsavelIds.length > 0
      ? await supabase.from("profiles").select("id, full_name").in("id", responsavelIds as string[])
      : { data: [] };
  const responsavelById = new Map((responsaveis ?? []).map((r) => [r.id, r.full_name]));

  return (
    <div className="mx-auto max-w-5xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/" className="text-sm text-neutral-500 underline">
            ← Voltar
          </Link>
          <h1 className="mt-2 text-lg font-semibold text-neutral-900">
            {profile.role === "ADMIN" ? "Todos os leads" : "Meus leads"}
          </h1>
        </div>
        <p className="text-sm text-neutral-500">{leads?.length ?? 0} leads</p>
      </div>

      <div className="mt-6 overflow-x-auto rounded-lg border border-neutral-200">
        <table className="w-full text-sm">
          <thead className="bg-neutral-50 text-left text-xs font-medium uppercase text-neutral-500">
            <tr>
              <th className="px-4 py-2">Empresa</th>
              <th className="px-4 py-2">Telefone</th>
              <th className="px-4 py-2">Status</th>
              <th className="px-4 py-2">Classificação</th>
              <th className="px-4 py-2">Responsável</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-200">
            {(leads ?? []).map((lead) => (
              <tr key={lead.id} className="hover:bg-neutral-50">
                <td className="px-4 py-2">
                  <Link href={`/leads/${lead.id}`} className="font-medium text-neutral-900 underline">
                    {lead.empresa}
                  </Link>
                </td>
                <td className="px-4 py-2 text-neutral-600">{lead.telefone}</td>
                <td className="px-4 py-2 text-neutral-600">{STATUS_LABEL[lead.status] ?? lead.status}</td>
                <td className="px-4 py-2 text-neutral-600">
                  {CLASSIFICACAO_LABEL[lead.classificacao as Classificacao]} · {lead.score}
                </td>
                <td className="px-4 py-2 text-neutral-600">
                  {lead.responsavel_id
                    ? responsavelById.get(lead.responsavel_id) ?? "—"
                    : lead.responsavel_legado_texto || "Não atribuído"}
                </td>
              </tr>
            ))}
            {(leads ?? []).length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-neutral-500">
                  Nenhum lead ainda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
