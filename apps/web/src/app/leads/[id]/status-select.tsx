"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "NOVO", label: "Novo" },
  { value: "CONTATO_REALIZADO", label: "Contato realizado" },
  { value: "INTERAGINDO", label: "Interagindo" },
  { value: "QUALIFICADO", label: "Qualificado" },
  { value: "REUNIAO_AGENDADA", label: "Reunião agendada" },
  { value: "PROPOSTA_ENVIADA", label: "Proposta enviada" },
  { value: "NEGOCIACAO", label: "Negociação" },
  { value: "GANHO", label: "Ganho" },
  { value: "PERDIDO", label: "Perdido" },
  { value: "SEM_INTERESSE", label: "Sem interesse" },
  { value: "SEM_RESPOSTA", label: "Sem resposta" },
];

export function StatusSelect({ leadId, currentStatus }: { leadId: string; currentStatus: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/leads/${leadId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: e.target.value }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Erro ao mudar status.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <select
        defaultValue={currentStatus}
        onChange={handleChange}
        disabled={saving}
        className="!py-1.5 !text-xs font-medium"
      >
        {STATUS_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-(--danger)">{error}</p>}
    </div>
  );
}
