"use client";

import { useEffect, useState, useCallback } from "react";

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
    <>
      <div className="topbar">
        <div>
          <h1>Notificações do admin</h1>
          <p>
            Alertas (venda fechada, lead quente, WhatsApp desconectado) e resumos vão pro grupo abaixo, agrupados —
            nunca um por evento.
          </p>
        </div>
      </div>

      {loading ? (
        <p className="empty">Carregando...</p>
      ) : settings ? (
        <form onSubmit={handleSubmit} className="box max-w-xl">
          <div className="mb-4">
            <label>JID do grupo do WhatsApp</label>
            <input
              value={settings.notification_group_jid ?? ""}
              onChange={(e) => setSettings({ ...settings, notification_group_jid: e.target.value })}
              placeholder="123456789-987654321@g.us"
              className="font-mono"
            />
            <p className="mt-1 text-xs text-(--muted)">
              Crie um grupo, adicione o número do admin conectado no <code>wa-agent</code>, e copie o JID que aparece
              no terminal do agente ao conectar (lista os grupos que participa).
            </p>
          </div>

          <div className="mb-4">
            <label>Intervalo do resumo periódico (minutos)</label>
            <input
              type="number"
              min={15}
              value={settings.digest_interval_minutes}
              onChange={(e) => setSettings({ ...settings, digest_interval_minutes: Number(e.target.value) })}
            />
          </div>

          <div className="mb-1">
            <label>Horário do fechamento diário</label>
            <input
              type="time"
              value={settings.daily_summary_time?.slice(0, 5) ?? "18:00"}
              onChange={(e) => setSettings({ ...settings, daily_summary_time: e.target.value })}
            />
            <p className="mt-1 text-xs text-(--muted)">
              O agendamento real do cron da Vercel é fixo (21:00 UTC / 18:00 horário de Brasília) — mudar esse campo
              exige reconfigurar <code>vercel.json</code> e reimplantar.
            </p>
          </div>

          {error && <p className="mt-3 text-sm text-(--danger)">{error}</p>}
          {saved && <p className="mt-3 text-sm text-(--success)">Salvo.</p>}

          <button type="submit" disabled={saving} className="btn mt-4">
            {saving && <span className="loader" />}
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </form>
      ) : (
        <p className="text-sm text-(--danger)">{error}</p>
      )}
    </>
  );
}
