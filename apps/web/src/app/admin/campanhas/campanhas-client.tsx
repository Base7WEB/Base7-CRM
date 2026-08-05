"use client";

import { useEffect, useState, useCallback } from "react";

type Campaign = {
  id: string;
  nome: string;
  status: string;
  intervalo_min_seg: number;
  intervalo_max_seg: number;
  counts: { total: number; enviado: number; falhou: number; pendente: number };
};

const STATUS_LEAD_OPTIONS = [
  { value: "NOVO", label: "Novo" },
  { value: "CONTATO_REALIZADO", label: "Contato realizado" },
  { value: "SEM_RESPOSTA", label: "Sem resposta" },
];

const STATUS_CAMPANHA_BADGE: Record<string, string> = {
  RASCUNHO: "badge-status",
  EM_EXECUCAO: "badge-success",
  PAUSADA: "badge-medium",
  FINALIZADA: "badge-cold",
  CANCELADA: "badge-hot",
};

export function CampanhasClient() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/campaigns");
    const json = await res.json();
    if (res.ok) setCampaigns(json.campaigns);
    else setError(json.error ?? "Erro ao carregar campanhas.");
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(formData: FormData) {
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome: formData.get("nome"),
        corpo_mensagem: formData.get("corpo_mensagem"),
        status_filtro: formData.get("status_filtro"),
        intervalo_min_seg: Number(formData.get("intervalo_min_seg")),
        intervalo_max_seg: Number(formData.get("intervalo_max_seg")),
      }),
    });
    const json = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(json.error ?? "Erro ao criar campanha.");
      return;
    }
    await load();
  }

  async function handleStart(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/campaigns/${id}/start`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro ao iniciar campanha.");
      return;
    }
    await load();
  }

  async function handleCancel(id: string) {
    setError(null);
    const res = await fetch(`/api/admin/campaigns/${id}/cancel`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro ao cancelar campanha.");
      return;
    }
    await load();
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Campanhas</h1>
          <p>
            Só uma campanha pode estar em execução por vez. Mensagens são espaçadas aleatoriamente por consultor pra
            reduzir risco de bloqueio no WhatsApp.
          </p>
        </div>
      </div>

      <form action={handleCreate} className="box">
        <div className="mb-3">
          <label>Nome</label>
          <input name="nome" required />
        </div>
        <div className="mb-3">
          <label>Mensagem (use {"{empresa}"} como variável)</label>
          <textarea name="corpo_mensagem" required rows={3} />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="min-w-[200px]">
            <label>Enviar para leads com status</label>
            <select name="status_filtro">
              {STATUS_LEAD_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="w-28">
            <label>Intervalo mín. (s)</label>
            <input type="number" name="intervalo_min_seg" defaultValue={30} min={15} />
          </div>
          <div className="w-28">
            <label>Intervalo máx. (s)</label>
            <input type="number" name="intervalo_max_seg" defaultValue={90} min={15} />
          </div>
        </div>
        <button type="submit" disabled={creating} className="btn mt-2">
          {creating && <span className="loader" />}
          {creating ? "Criando..." : "Criar campanha"}
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-(--danger)">{error}</p>}

      <div className="box">
        {loading ? (
          <p className="empty">Carregando...</p>
        ) : campaigns.length === 0 ? (
          <p className="empty">Nenhuma campanha ainda.</p>
        ) : (
          <div className="divide-y divide-(--border)">
            {campaigns.map((c) => (
              <div key={c.id} className="flex items-center justify-between gap-3 py-4 first:pt-0 last:pb-0">
                <div>
                  <p className="font-semibold text-white">{c.nome}</p>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-(--muted)">
                    <span className={`badge ${STATUS_CAMPANHA_BADGE[c.status] ?? "badge-status"}`}>{c.status}</span>
                    {c.counts.total} leads · {c.counts.enviado} enviados · {c.counts.falhou} falharam ·{" "}
                    {c.counts.pendente} pendentes
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  {(c.status === "RASCUNHO" || c.status === "PAUSADA") && (
                    <button onClick={() => handleStart(c.id)} className="btn-outline btn-sm">
                      Iniciar
                    </button>
                  )}
                  {(c.status === "EM_EXECUCAO" || c.status === "RASCUNHO") && (
                    <button onClick={() => handleCancel(c.id)} className="btn-ghost btn-sm">
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
