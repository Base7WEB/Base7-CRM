"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type Option = { id: string; full_name: string };

export function AssignResponsavel({
  leadId,
  currentId,
  options,
}: {
  leadId: string;
  currentId: string | null;
  options: Option[];
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    setSaving(true);
    setError(null);
    const res = await fetch(`/api/admin/leads/${leadId}/assign`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ responsavel_id: e.target.value || null }),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Erro ao reatribuir lead.");
      return;
    }
    router.refresh();
  }

  return (
    <div>
      <select defaultValue={currentId ?? ""} onChange={handleChange} disabled={saving} className="max-w-xs">
        <option value="">Não atribuído</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.full_name}
          </option>
        ))}
      </select>
      {error && <p className="mt-1 text-xs text-(--danger)">{error}</p>}
    </div>
  );
}
