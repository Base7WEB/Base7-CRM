"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";

type CampaignLead = {
  id: string;
  status: string;
  updated_at: string;
  simulado: boolean;
  followups_enviados: number;
  lead_id: string;
  leads: { id: string; empresa: string; telefone: string; status: string; classificacao: string } | null;
};

type Campaign = {
  id: string;
  nome: string;
  descricao: string;
  nicho: string | null;
  cidade: string | null;
  tags: string[];
  corpo_mensagem: string;
  status: string;
  intervalo_min_seg: number;
  intervalo_max_seg: number;
  limite_diario: number;
  limite_campanha: number | null;
  modo_teste: boolean;
  modo_conservador: boolean;
};

type Followup = { id: string; ordem: number; dias: number; texto: string };

type Metrics = {
  total: number;
  enviado: number;
  falhou: number;
  pulado: number;
  pendente: number;
  respostas: number;
  taxaResposta: number | null;
  quentes: number;
  reunioes: number;
  propostas: number;
  vendas: number;
};

const STATUS_CAMPANHA_BADGE: Record<string, string> = {
  RASCUNHO: "badge-status",
  EM_EXECUCAO: "badge-success",
  PAUSADA: "badge-medium",
  FINALIZADA: "badge-cold",
  CANCELADA: "badge-hot",
};

const LEAD_STATUS_BADGE: Record<string, string> = {
  PENDENTE: "badge-status",
  ENFILEIRADO: "badge-medium",
  ENVIADO: "badge-success",
  FALHOU: "badge-hot",
  PULADO: "badge-cold",
};

function pct(n: number | null): string {
  if (n === null) return "—";
  return `${Math.round(n * 100)}%`;
}

export function CampaignDetailClient({ campaignId }: { campaignId: string }) {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [leads, setLeads] = useState<CampaignLead[]>([]);
  const [followups, setFollowups] = useState<Followup[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async () => {
    const res = await fetch(`/api/admin/campaigns/${campaignId}`);
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro ao carregar campanha.");
      return;
    }
    setCampaign(json.campaign);
    setLeads(json.leads);
    setFollowups(json.followups ?? []);
    setMetrics(json.metrics);
    setError(null);
  }, [campaignId]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    if (campaign?.status === "EM_EXECUCAO") {
      pollRef.current = setInterval(load, 5000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [campaign?.status, load]);

  async function handleAction(action: "start" | "cancel" | "pause") {
    setError(null);
    const res = await fetch(`/api/admin/campaigns/${campaignId}/${action}`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro na ação.");
      return;
    }
    await load();
  }

  async function handleDelete() {
    if (!campaign) return;
    if (!confirm(`Excluir a campanha "${campaign.nome}"? Essa ação não pode ser desfeita.`)) return;
    setError(null);
    const res = await fetch(`/api/admin/campaigns/${campaignId}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro ao excluir.");
      return;
    }
    window.location.href = "/admin/campanhas";
  }

  async function handleSkip(campaignLeadId: string) {
    setError(null);
    const res = await fetch(`/api/admin/campaigns/${campaignId}/skip-lead`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ campaign_lead_id: campaignLeadId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro ao pular lead.");
      return;
    }
    await load();
  }

  if (!campaign || !metrics) {
    return <p className="empty">{error ?? "Carregando..."}</p>;
  }

  return (
    <>
      <Link href="/admin/campanhas" className="mb-2 inline-block text-sm text-(--muted) hover:text-(--cyan)">
        ← Voltar
      </Link>

      <div className="topbar">
        <div>
          <h1>{campaign.nome}</h1>
          <p>
            Intervalo {campaign.intervalo_min_seg}–{campaign.intervalo_max_seg}s entre envios por consultor
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`badge ${STATUS_CAMPANHA_BADGE[campaign.status] ?? "badge-status"}`}>{campaign.status}</span>
          {campaign.modo_teste && <span className="badge badge-medium">🧪 Teste</span>}
          {campaign.modo_conservador && <span className="badge badge-cold">🐢 Conservador</span>}
          {(campaign.status === "RASCUNHO" || campaign.status === "PAUSADA") && (
            <button onClick={() => handleAction("start")} className="btn-outline btn-sm">
              {campaign.status === "PAUSADA" ? "Retomar" : "Iniciar"}
            </button>
          )}
          {campaign.status === "EM_EXECUCAO" && (
            <button onClick={() => handleAction("pause")} className="btn-outline btn-sm">
              Pausar
            </button>
          )}
          {(campaign.status === "EM_EXECUCAO" || campaign.status === "PAUSADA" || campaign.status === "RASCUNHO") && (
            <button onClick={() => handleAction("cancel")} className="btn-ghost btn-sm">
              Parar
            </button>
          )}
          {(campaign.status === "RASCUNHO" || campaign.status === "CANCELADA" || campaign.status === "FINALIZADA") && (
            <button onClick={handleDelete} className="btn-ghost btn-sm text-(--danger)">
              Excluir
            </button>
          )}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-(--danger)">{error}</p>}

      {(campaign.descricao || campaign.nicho || campaign.cidade || campaign.tags.length > 0) && (
        <div className="box">
          <p className="text-xs uppercase text-(--muted)">Sobre a campanha</p>
          <p className="mt-1 text-sm text-(--text)">
            {campaign.descricao || "—"}
            {campaign.nicho && ` · Nicho: ${campaign.nicho}`}
            {campaign.cidade && ` · Cidade: ${campaign.cidade}`}
            {campaign.tags.length > 0 && ` · Tags: ${campaign.tags.join(", ")}`}
          </p>
        </div>
      )}

      <div className="box">
        <p className="text-xs uppercase text-(--muted)">Mensagem</p>
        <p className="mt-1 whitespace-pre-wrap text-sm">{campaign.corpo_mensagem}</p>
        <p className="mt-2 text-xs text-(--muted)">
          Limite diário: {campaign.limite_diario} · Limite da campanha: {campaign.limite_campanha ?? "sem limite"}
        </p>
      </div>

      {followups.length > 0 && (
        <div className="box">
          <div className="box-header">
            <h2>Follow-ups automáticos</h2>
          </div>
          <div className="divide-y divide-(--border)">
            {followups.map((f) => (
              <div key={f.id} className="py-2 text-sm">
                <p className="text-xs uppercase text-(--muted)">Após {f.dias} dia(s) sem resposta</p>
                <p className="mt-1 whitespace-pre-wrap">{f.texto}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-icon si-blue">👥</div>
          <div className="stat-body">
            <p className="stat-num">{metrics.total}</p>
            <p className="stat-label">Leads na campanha</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon si-cyan">📤</div>
          <div className="stat-body">
            <p className="stat-num">{metrics.enviado}</p>
            <p className="stat-label">Enviados</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon si-purple">📩</div>
          <div className="stat-body">
            <p className="stat-num">{metrics.respostas}</p>
            <p className="stat-label">Respostas</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon si-cyan">📈</div>
          <div className="stat-body">
            <p className="stat-num">{pct(metrics.taxaResposta)}</p>
            <p className="stat-label">Taxa de resposta</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon si-rose">🔥</div>
          <div className="stat-body">
            <p className="stat-num">{metrics.quentes}</p>
            <p className="stat-label">Leads quentes</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon si-yellow">📅</div>
          <div className="stat-body">
            <p className="stat-num">{metrics.reunioes}</p>
            <p className="stat-label">Reuniões</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon si-purple">📄</div>
          <div className="stat-body">
            <p className="stat-num">{metrics.propostas}</p>
            <p className="stat-label">Propostas</p>
          </div>
        </div>
        <div className="stat-card">
          <div className="stat-icon si-green">🤝</div>
          <div className="stat-body">
            <p className="stat-num">{metrics.vendas}</p>
            <p className="stat-label">Vendas</p>
          </div>
        </div>
      </div>

      <div className="box">
        <div className="box-header">
          <h2>Fila ({leads.length} leads)</h2>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Empresa</th>
                <th>Telefone</th>
                <th>Status na fila</th>
                <th>Status do lead</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {leads.map((cl) => (
                <tr key={cl.id}>
                  <td>
                    {cl.leads ? (
                      <Link href={`/leads/${cl.leads.id}`} className="font-semibold text-white hover:text-(--cyan)">
                        {cl.leads.empresa}
                      </Link>
                    ) : (
                      "—"
                    )}
                  </td>
                  <td className="text-(--text)">{cl.leads?.telefone ?? "—"}</td>
                  <td>
                    <span className={`badge ${LEAD_STATUS_BADGE[cl.status] ?? "badge-status"}`}>{cl.status}</span>
                    {cl.simulado && <span className="badge badge-medium ml-1">🧪</span>}
                    {cl.followups_enviados > 0 && (
                      <span className="badge badge-status ml-1">{cl.followups_enviados}x follow-up</span>
                    )}
                  </td>
                  <td className="text-(--text)">{cl.leads?.status ?? "—"}</td>
                  <td>
                    {(cl.status === "PENDENTE" || cl.status === "ENFILEIRADO") && (
                      <button onClick={() => handleSkip(cl.id)} className="btn-ghost btn-sm">
                        Pular
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {leads.length === 0 && <p className="empty">Nenhum lead nesta campanha.</p>}
        </div>
      </div>
    </>
  );
}
