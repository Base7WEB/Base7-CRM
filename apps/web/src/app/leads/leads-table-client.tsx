"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Classificacao } from "@/lib/scoring";

type Lead = {
  id: string;
  empresa: string;
  nicho: string | null;
  cidade: string | null;
  telefone: string;
  site: string | null;
  instagram: string | null;
  status: string;
  classificacao: string;
  score: number;
  responsavel_id: string | null;
  responsavel_legado_texto: string | null;
};

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

export function LeadsTableClient({
  leads,
  responsavelById,
  consultores,
  isAdmin,
}: {
  leads: Lead[];
  responsavelById: Map<string, string>;
  consultores: { id: string; full_name: string }[];
  isAdmin: boolean;
}) {
  const router = useRouter();
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [consultorEscolhido, setConsultorEscolhido] = useState("");
  const [atribuindo, setAtribuindo] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const todosSelecionados = leads.length > 0 && selecionados.size === leads.length;

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleTodos() {
    setSelecionados(todosSelecionados ? new Set() : new Set(leads.map((l) => l.id)));
  }

  async function handleAtribuir() {
    setError(null);
    setAtribuindo(true);
    const res = await fetch("/api/admin/leads/bulk-assign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ lead_ids: [...selecionados], responsavel_id: consultorEscolhido || null }),
    });
    const json = await res.json();
    setAtribuindo(false);
    if (!res.ok) {
      setError(json.error ?? "Erro ao atribuir.");
      return;
    }
    setSelecionados(new Set());
    setConsultorEscolhido("");
    router.refresh();
  }

  const responsavelOptions = useMemo(
    () => [{ id: "", full_name: "Não atribuído" }, ...consultores],
    [consultores]
  );

  return (
    <div className="box">
      {isAdmin && selecionados.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-md border border-(--cyan)/30 bg-(--cyan)/5 p-3">
          <strong className="text-sm text-(--cyan)">{selecionados.size} selecionado(s)</strong>
          <select
            value={consultorEscolhido}
            onChange={(e) => setConsultorEscolhido(e.target.value)}
            className="max-w-xs"
          >
            {responsavelOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.full_name}
              </option>
            ))}
          </select>
          <button onClick={handleAtribuir} disabled={atribuindo} className="btn-sm bg-(--cyan)/15 text-(--cyan)">
            {atribuindo ? "Atribuindo..." : "Atribuir"}
          </button>
          <button onClick={() => setSelecionados(new Set())} className="btn-ghost btn-sm">
            Limpar seleção
          </button>
          {error && <span className="text-xs text-(--danger)">{error}</span>}
        </div>
      )}

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {isAdmin && (
                <th>
                  <input type="checkbox" checked={todosSelecionados} onChange={toggleTodos} />
                </th>
              )}
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
            {leads.map((lead) => (
              <tr key={lead.id}>
                {isAdmin && (
                  <td>
                    <input type="checkbox" checked={selecionados.has(lead.id)} onChange={() => toggle(lead.id)} />
                  </td>
                )}
                <td>
                  <Link href={`/leads/${lead.id}`} className="font-semibold text-white hover:text-(--cyan)">
                    {lead.empresa}
                  </Link>
                  {(lead.nicho || lead.cidade) && (
                    <p className="text-xs text-(--muted)">{[lead.nicho, lead.cidade].filter(Boolean).join(" · ")}</p>
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
                      href={lead.instagram.startsWith("http") ? lead.instagram : `https://instagram.com/${lead.instagram.replace(/^@/, "")}`}
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
        {leads.length === 0 && <p className="empty">Nenhum lead ainda.</p>}
      </div>
    </div>
  );
}
