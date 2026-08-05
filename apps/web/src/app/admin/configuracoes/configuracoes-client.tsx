"use client";

import { useEffect, useState, useCallback } from "react";

type Settings = {
  digest_interval_minutes: number;
  daily_summary_time: string;
  notification_group_jid: string | null;
  weekly_summary_weekday: number;
  weekly_summary_time: string;
  monthly_summary_rule: string;
  monthly_summary_time: string;
};

const DIAS_SEMANA = [
  { value: 0, label: "Domingo" },
  { value: 1, label: "Segunda-feira" },
  { value: 2, label: "Terça-feira" },
  { value: 3, label: "Quarta-feira" },
  { value: 4, label: "Quinta-feira" },
  { value: 5, label: "Sexta-feira" },
  { value: 6, label: "Sábado" },
];

const REGRAS_MENSAL = [
  { value: "ultimo_dia", label: "Último dia do mês" },
  { value: "ultima_sexta", label: "Última sexta-feira do mês" },
  { value: "ultimo_sabado", label: "Último sábado do mês" },
];

const PERIODOS: { value: "diario" | "semanal" | "mensal"; label: string }[] = [
  { value: "diario", label: "Disparar relatório diário" },
  { value: "semanal", label: "Disparar relatório semanal" },
  { value: "mensal", label: "Disparar relatório mensal" },
];

export function ConfiguracoesClient() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [testando, setTestando] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);
  const [disparando, setDisparando] = useState<string | null>(null);
  const [disparoResult, setDisparoResult] = useState<Record<string, string>>({});

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

  async function handleTestMessage() {
    setTestando(true);
    setTestResult(null);
    const res = await fetch("/api/admin/settings/test-message", { method: "POST" });
    const json = await res.json();
    setTestando(false);
    setTestResult(res.ok ? "Mensagem de teste enviada — confira o grupo." : (json.error ?? "Erro ao enviar."));
  }

  async function handleDisparar(periodo: "diario" | "semanal" | "mensal") {
    setDisparando(periodo);
    setDisparoResult((prev) => ({ ...prev, [periodo]: "" }));
    const res = await fetch(`/api/admin/reports/${periodo}`, { method: "POST" });
    const json = await res.json();
    setDisparando(null);
    setDisparoResult((prev) => ({
      ...prev,
      [periodo]: res.ok ? "Enviado — confira o grupo." : (json.error ?? "Erro ao enviar."),
    }));
  }

  if (loading) return <p className="empty">Carregando...</p>;
  if (!settings) return <p className="text-sm text-(--danger)">{error}</p>;

  return (
    <>
      <div className="box max-w-xl">
        <div className="box-header">
          <h2>Disparar relatório agora</h2>
        </div>
        <p className="mb-3 text-xs text-(--muted)">
          Envia o relatório completo pro grupo na hora, ignorando se já foi enviado hoje/essa semana/esse mês.
        </p>
        <div className="flex flex-col gap-2">
          {PERIODOS.map((p) => (
            <div key={p.value} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleDisparar(p.value)}
                disabled={disparando !== null || !settings.notification_group_jid}
                className="btn-outline btn-sm shrink-0"
              >
                {disparando === p.value ? "Enviando..." : p.label}
              </button>
              {disparoResult[p.value] && <span className="text-xs text-(--text)">{disparoResult[p.value]}</span>}
            </div>
          ))}
        </div>
      </div>

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
          <label>Intervalo do resumo agrupado de alertas (minutos)</label>
          <input
            type="number"
            min={15}
            value={settings.digest_interval_minutes}
            onChange={(e) => setSettings({ ...settings, digest_interval_minutes: Number(e.target.value) })}
          />
        </div>

        <div className="mb-4 border-t border-(--border) pt-4">
          <p className="mb-2 text-xs font-semibold uppercase text-(--muted)">Relatório diário</p>
          <label>Horário</label>
          <input
            type="time"
            value={settings.daily_summary_time?.slice(0, 5) ?? "18:00"}
            onChange={(e) => setSettings({ ...settings, daily_summary_time: e.target.value })}
          />
        </div>

        <div className="mb-4 border-t border-(--border) pt-4">
          <p className="mb-2 text-xs font-semibold uppercase text-(--muted)">Relatório semanal</p>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[160px] flex-1">
              <label>Dia da semana</label>
              <select
                value={settings.weekly_summary_weekday}
                onChange={(e) => setSettings({ ...settings, weekly_summary_weekday: Number(e.target.value) })}
              >
                {DIAS_SEMANA.map((d) => (
                  <option key={d.value} value={d.value}>
                    {d.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label>Horário</label>
              <input
                type="time"
                value={settings.weekly_summary_time?.slice(0, 5) ?? "18:00"}
                onChange={(e) => setSettings({ ...settings, weekly_summary_time: e.target.value })}
              />
            </div>
          </div>
        </div>

        <div className="mb-1 border-t border-(--border) pt-4">
          <p className="mb-2 text-xs font-semibold uppercase text-(--muted)">Relatório mensal</p>
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[200px] flex-1">
              <label>Quando enviar</label>
              <select
                value={settings.monthly_summary_rule}
                onChange={(e) => setSettings({ ...settings, monthly_summary_rule: e.target.value })}
              >
                {REGRAS_MENSAL.map((r) => (
                  <option key={r.value} value={r.value}>
                    {r.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="w-32">
              <label>Horário</label>
              <input
                type="time"
                value={settings.monthly_summary_time?.slice(0, 5) ?? "18:00"}
                onChange={(e) => setSettings({ ...settings, monthly_summary_time: e.target.value })}
              />
            </div>
          </div>
          <p className="mt-2 text-xs text-(--muted)">
            O agendamento real (diário/semanal/mensal) roda dentro do mesmo cron nativo da Vercel, fixo em 21:00 UTC
            (18:00 horário de Brasília) — mudar os horários acima exige reconfigurar <code>vercel.json</code> e
            reimplantar. O dia da semana e a regra do mês valem sem precisar mexer no deploy.
          </p>
        </div>

        {error && <p className="mt-3 text-sm text-(--danger)">{error}</p>}
        {saved && <p className="mt-3 text-sm text-(--success)">Salvo.</p>}

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button type="submit" disabled={saving} className="btn">
            {saving && <span className="loader" />}
            {saving ? "Salvando..." : "Salvar"}
          </button>
          <button
            type="button"
            onClick={handleTestMessage}
            disabled={testando || !settings.notification_group_jid}
            className="btn-outline"
          >
            {testando && <span className="loader" />}
            {testando ? "Enviando..." : "Enviar mensagem de teste"}
          </button>
        </div>
        {testResult && <p className="mt-2 text-sm text-(--text)">{testResult}</p>}
      </form>
    </>
  );
}
