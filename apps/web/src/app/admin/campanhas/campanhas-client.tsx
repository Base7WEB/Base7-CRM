"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

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
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-neutral-500 underline">
        ← Voltar
      </Link>
      <h1 className="mt-2 text-lg font-semibold text-neutral-900">Campanhas</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Só uma campanha pode estar em execução por vez. Mensagens são espaçadas aleatoriamente por consultor pra
        reduzir risco de bloqueio no WhatsApp.
      </p>

      <form
        action={handleCreate}
        className="mt-6 space-y-3 rounded-lg border border-neutral-200 p-4"
      >
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-600">Nome</label>
          <input name="nome" required className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
        </div>
        <div className="space-y-1">
          <label className="text-xs font-medium text-neutral-600">Mensagem (use {"{empresa}"} como variável)</label>
          <textarea
            name="corpo_mensagem"
            required
            rows={3}
            className="w-full rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
          />
        </div>
        <div className="flex flex-wrap gap-3">
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-600">Enviar para leads com status</label>
            <select name="status_filtro" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
              {STATUS_LEAD_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-600">Intervalo mín. (s)</label>
            <input
              type="number"
              name="intervalo_min_seg"
              defaultValue={30}
              min={15}
              className="w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
          <div className="space-y-1">
            <label className="text-xs font-medium text-neutral-600">Intervalo máx. (s)</label>
            <input
              type="number"
              name="intervalo_max_seg"
              defaultValue={90}
              min={15}
              className="w-24 rounded-md border border-neutral-300 px-2 py-1.5 text-sm"
            />
          </div>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {creating ? "Criando..." : "Criar campanha"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
        {loading ? (
          <p className="p-4 text-sm text-neutral-500">Carregando...</p>
        ) : campaigns.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">Nenhuma campanha ainda.</p>
        ) : (
          campaigns.map((c) => (
            <div key={c.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-900">{c.nome}</p>
                  <p className="text-xs text-neutral-500">
                    {c.status} · {c.counts.total} leads · {c.counts.enviado} enviados · {c.counts.falhou} falharam ·{" "}
                    {c.counts.pendente} pendentes
                  </p>
                </div>
                <div className="flex gap-2">
                  {(c.status === "RASCUNHO" || c.status === "PAUSADA") && (
                    <button
                      onClick={() => handleStart(c.id)}
                      className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                    >
                      Iniciar
                    </button>
                  )}
                  {(c.status === "EM_EXECUCAO" || c.status === "RASCUNHO") && (
                    <button
                      onClick={() => handleCancel(c.id)}
                      className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
