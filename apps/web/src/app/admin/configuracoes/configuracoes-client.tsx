"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";

type Settings = {
  digest_interval_minutes: number;
  daily_summary_time: string;
  notification_group_jid: string | null;
};

export function ConfiguracoesClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/settings");
    const json = await res.json();
    if (res.ok) setSettings(json.settings);
    else setError(json.error ?? "Erro ao carregar configurações.");
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!settings) return;
    setSaving(true);
    setError(null);
    setSaved(false);

    const res = await fetch("/api/admin/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    if (!res.ok) {
      const json = await res.json();
      setError(json.error ?? "Erro ao salvar.");
      return;
    }
    setSaved(true);
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link href="/" className="text-sm text-neutral-500 underline">
        ← Voltar
      </Link>
      <h1 className="mt-2 text-lg font-semibold text-neutral-900">Notificações do admin</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Alertas (venda fechada, lead quente, WhatsApp desconectado) e resumos vão para o grupo do WhatsApp abaixo,
        agrupados — nunca um por evento.
      </p>

      {loading ? (
        <p className="mt-6 text-sm text-neutral-500">Carregando...</p>
      ) : settings ? (
        <form onSubmit={handleSubmit} className="mt-6 space-y-4 rounded-lg border border-neutral-200 p-4">
          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">JID do grupo do WhatsApp</label>
            <input
              value={settings.notification_group_jid ?? ""}
              onChange={(e) => setSettings({ ...settings, notification_group_jid: e.target.value })}
              placeholder="123456789-987654321@g.us"
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm font-mono"
            />
            <p className="text-xs text-neutral-500">
              Crie um grupo, adicione o número do admin conectado no <code>wa-agent</code>, e copie o JID que aparece
              no terminal do agente ao conectar (lista os grupos que participa).
            </p>
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">Intervalo do resumo periódico (minutos)</label>
            <input
              type="number"
              min={15}
              value={settings.digest_interval_minutes}
              onChange={(e) => setSettings({ ...settings, digest_interval_minutes: Number(e.target.value) })}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm font-medium text-neutral-700">Horário do fechamento diário</label>
            <input
              type="time"
              value={settings.daily_summary_time?.slice(0, 5) ?? "18:00"}
              onChange={(e) => setSettings({ ...settings, daily_summary_time: e.target.value })}
              className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm"
            />
            <p className="text-xs text-neutral-500">
              O agendamento real do cron da Vercel é fixo (21:00 UTC / 18:00 horário de Brasília) — mudar esse campo
              exige reconfigurar <code>vercel.json</code> e reimplantar.
            </p>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {saved && <p className="text-sm text-green-700">Salvo.</p>}

          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </form>
      ) : (
        <p className="mt-6 text-sm text-red-600">{error}</p>
      )}
    </div>
  );
}
