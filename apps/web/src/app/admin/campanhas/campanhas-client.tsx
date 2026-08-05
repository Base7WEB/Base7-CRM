"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Campaign = {
  id: string;
  nome: string;
  descricao: string;
  nicho: string | null;
  cidade: string | null;
  tags: string[];
  status: string;
  modo_teste: boolean;
  modo_conservador: boolean;
  limite_diario: number;
  limite_campanha: number | null;
  intervalo_min_seg: number;
  intervalo_max_seg: number;
  counts: { total: number; enviado: number; falhou: number; pulado: number; pendente: number };
};

type LeadOption = {
  id: string;
  empresa: string;
  telefone: string;
  nicho: string | null;
  cidade: string | null;
  status: string;
  classificacao: string;
  score: number;
  responsavel_id: string | null;
  responsavel_nome: string | null;
};

type Template = { id: string; stage: string; title: string; body: string };

type Followup = { dias: number; texto: string };

const STATUS_LEAD_OPTIONS = [
  { value: "", label: "Qualquer status" },
  { value: "NOVO", label: "Novo" },
  { value: "CONTATO_REALIZADO", label: "Contato realizado" },
  { value: "INTERAGINDO", label: "Interagindo" },
  { value: "QUALIFICADO", label: "Qualificado" },
  { value: "SEM_RESPOSTA", label: "Sem resposta" },
  { value: "SEM_INTERESSE", label: "Sem interesse" },
];

const STATUS_CAMPANHA_BADGE: Record<string, string> = {
  RASCUNHO: "badge-status",
  EM_EXECUCAO: "badge-success",
  PAUSADA: "badge-medium",
  FINALIZADA: "badge-cold",
  CANCELADA: "badge-hot",
};

const PLACEHOLDER_HELP = "{empresa} {responsavel} {cidade} {nicho} {rating} {site} {instagram}";

function renderPreview(texto: string, lead: LeadOption | null): string {
  if (!lead) return texto;
  return texto
    .replaceAll("{empresa}", lead.empresa ?? "")
    .replaceAll("{responsavel}", lead.responsavel_nome ?? "")
    .replaceAll("{cidade}", lead.cidade ?? "")
    .replaceAll("{nicho}", lead.nicho ?? "")
    .replaceAll("{rating}", "")
    .replaceAll("{site}", "")
    .replaceAll("{instagram}", "");
}

export function CampanhasClient() {
  const supabase = useMemo(() => createClient(), []);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);

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

  async function handleAction(id: string, action: "start" | "cancel" | "pause") {
    setError(null);
    const res = await fetch(`/api/admin/campaigns/${id}/${action}`, { method: "POST" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro na ação.");
      return;
    }
    await load();
  }

  async function handleDelete(id: string, nome: string) {
    if (!confirm(`Excluir a campanha "${nome}"? Essa ação não pode ser desfeita.`)) return;
    setError(null);
    const res = await fetch(`/api/admin/campaigns/${id}`, { method: "DELETE" });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro ao excluir.");
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
        <button className="btn" onClick={() => setShowWizard((v) => !v)}>
          {showWizard ? "Fechar" : "+ Nova campanha"}
        </button>
      </div>

      {error && <p className="mb-4 text-sm text-(--danger)">{error}</p>}

      {showWizard && (
        <CampaignWizard
          supabase={supabase}
          onCreated={async () => {
            setShowWizard(false);
            await load();
          }}
          onError={setError}
        />
      )}

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
                  <Link href={`/admin/campanhas/${c.id}`} className="font-semibold text-white hover:text-(--cyan)">
                    {c.nome}
                  </Link>
                  <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-(--muted)">
                    <span className={`badge ${STATUS_CAMPANHA_BADGE[c.status] ?? "badge-status"}`}>{c.status}</span>
                    {c.modo_teste && <span className="badge badge-medium">🧪 Teste</span>}
                    {c.modo_conservador && <span className="badge badge-cold">🐢 Conservador</span>}
                    {c.counts.total} leads · {c.counts.enviado} enviados · {c.counts.falhou} falharam ·{" "}
                    {c.counts.pulado} pulados · {c.counts.pendente} pendentes
                  </p>
                  {(c.descricao || c.nicho || c.cidade || c.tags.length > 0) && (
                    <p className="mt-1 text-xs text-(--muted)">
                      {c.descricao}
                      {c.nicho && ` · ${c.nicho}`}
                      {c.cidade && ` · ${c.cidade}`}
                      {c.tags.length > 0 && ` · ${c.tags.join(", ")}`}
                    </p>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  {(c.status === "RASCUNHO" || c.status === "PAUSADA") && (
                    <button onClick={() => handleAction(c.id, "start")} className="btn-outline btn-sm">
                      {c.status === "PAUSADA" ? "Retomar" : "Iniciar"}
                    </button>
                  )}
                  {c.status === "EM_EXECUCAO" && (
                    <button onClick={() => handleAction(c.id, "pause")} className="btn-outline btn-sm">
                      Pausar
                    </button>
                  )}
                  {(c.status === "EM_EXECUCAO" || c.status === "PAUSADA" || c.status === "RASCUNHO") && (
                    <button onClick={() => handleAction(c.id, "cancel")} className="btn-ghost btn-sm">
                      Parar
                    </button>
                  )}
                  {(c.status === "RASCUNHO" || c.status === "CANCELADA" || c.status === "FINALIZADA") && (
                    <button onClick={() => handleDelete(c.id, c.nome)} className="btn-ghost btn-sm text-(--danger)">
                      Excluir
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

function CampaignWizard({
  supabase,
  onCreated,
  onError,
}: {
  supabase: ReturnType<typeof createClient>;
  onCreated: () => void;
  onError: (msg: string) => void;
}) {
  // Passo 1 -- info básica
  const [nome, setNome] = useState("");
  const [descricao, setDescricao] = useState("");
  const [nicho, setNicho] = useState("");
  const [cidade, setCidade] = useState("");
  const [tagsTexto, setTagsTexto] = useState("");

  // Passo 2 -- seleção de leads
  const [filtroNicho, setFiltroNicho] = useState("");
  const [filtroCidade, setFiltroCidade] = useState("");
  const [filtroStatus, setFiltroStatus] = useState("");
  const [filtroScoreMin, setFiltroScoreMin] = useState(0);
  const [leadsEncontrados, setLeadsEncontrados] = useState<LeadOption[]>([]);
  const [buscandoLeads, setBuscandoLeads] = useState(false);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());

  // Passo 3 -- mensagem
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateId, setTemplateId] = useState("");
  const [mensagem, setMensagem] = useState("");

  // Passo 4 -- follow-ups
  const [followups, setFollowups] = useState<Followup[]>([]);

  // Passo 5 -- configurações
  const [intervaloMin, setIntervaloMin] = useState(20);
  const [intervaloMax, setIntervaloMax] = useState(60);
  const [limiteDiario, setLimiteDiario] = useState(80);
  const [limiteCampanha, setLimiteCampanha] = useState(0);
  const [modoConservador, setModoConservador] = useState(false);
  const [modoTeste, setModoTeste] = useState(false);

  const [creating, setCreating] = useState(false);

  useEffect(() => {
    supabase
      .from("message_templates")
      .select("id, stage, title, body")
      .order("stage")
      .then(({ data }) => setTemplates(data ?? []));
  }, [supabase]);

  const templatesPorEtapa = useMemo(() => {
    const map = new Map<string, Template[]>();
    for (const t of templates) {
      if (!map.has(t.stage)) map.set(t.stage, []);
      map.get(t.stage)!.push(t);
    }
    return map;
  }, [templates]);

  async function buscarLeads() {
    setBuscandoLeads(true);
    let query = supabase
      .from("leads")
      .select("id, empresa, telefone, nicho, cidade, status, classificacao, score, responsavel_id")
      .not("responsavel_id", "is", null)
      .order("empresa")
      .limit(300);
    if (filtroNicho) query = query.ilike("nicho", `%${filtroNicho}%`);
    if (filtroCidade) query = query.ilike("cidade", `%${filtroCidade}%`);
    if (filtroStatus) query = query.eq("status", filtroStatus);
    if (filtroScoreMin > 0) query = query.gte("score", filtroScoreMin);
    const { data: leads } = await query;

    const responsavelIds = [...new Set((leads ?? []).map((l) => l.responsavel_id).filter((v): v is string => !!v))];
    const { data: consultores } =
      responsavelIds.length > 0
        ? await supabase.from("profiles").select("id, full_name").in("id", responsavelIds)
        : { data: [] };
    const nomeById = new Map((consultores ?? []).map((c) => [c.id, c.full_name]));

    setLeadsEncontrados(
      (leads ?? []).map((l) => ({
        ...l,
        responsavel_nome: l.responsavel_id ? nomeById.get(l.responsavel_id) ?? null : null,
      }))
    );
    setBuscandoLeads(false);
  }

  useEffect(() => {
    buscarLeads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toggleLead(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selecionarTodosFiltrados() {
    setSelecionados((prev) => {
      const next = new Set(prev);
      for (const l of leadsEncontrados) next.add(l.id);
      return next;
    });
  }

  function limparSelecaoFiltrados() {
    setSelecionados((prev) => {
      const next = new Set(prev);
      for (const l of leadsEncontrados) next.delete(l.id);
      return next;
    });
  }

  function aplicarTemplate(id: string) {
    setTemplateId(id);
    const t = templates.find((tpl) => tpl.id === id);
    if (t) setMensagem(t.body);
  }

  function addFollowup() {
    setFollowups((prev) => [...prev, { dias: 3, texto: "" }]);
  }

  function updateFollowup(i: number, patch: Partial<Followup>) {
    setFollowups((prev) => prev.map((f, idx) => (idx === i ? { ...f, ...patch } : f)));
  }

  function removeFollowup(i: number) {
    setFollowups((prev) => prev.filter((_, idx) => idx !== i));
  }

  const primeiroSelecionado = leadsEncontrados.find((l) => selecionados.has(l.id)) ?? null;

  async function handleSubmit() {
    if (!nome.trim() || !mensagem.trim()) {
      onError("Nome e mensagem são obrigatórios.");
      return;
    }
    if (selecionados.size === 0) {
      onError("Selecione ao menos 1 lead na tabela do passo 2.");
      return;
    }
    setCreating(true);
    const res = await fetch("/api/admin/campaigns", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        nome,
        descricao,
        nicho: nicho || null,
        cidade: cidade || null,
        tags: tagsTexto
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        lead_ids: [...selecionados],
        corpo_mensagem: mensagem,
        followups: followups.filter((f) => f.texto.trim() && f.dias > 0),
        intervalo_min_seg: intervaloMin,
        intervalo_max_seg: intervaloMax,
        limite_diario: limiteDiario,
        limite_campanha: limiteCampanha,
        modo_conservador: modoConservador,
        modo_teste: modoTeste,
      }),
    });
    const json = await res.json();
    setCreating(false);
    if (!res.ok) {
      onError(json.error ?? "Erro ao criar campanha.");
      return;
    }
    onCreated();
  }

  return (
    <div className="box">
      <div className="box-header">
        <h2>1. Informações básicas</h2>
      </div>
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="min-w-[220px] flex-1">
          <label>Nome da campanha</label>
          <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="ex: Reativação Barbearias SP" />
        </div>
        <div className="min-w-[220px] flex-1">
          <label>Descrição (opcional)</label>
          <input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
        </div>
      </div>
      <div className="mb-6 flex flex-wrap gap-3">
        <div className="min-w-[160px] flex-1">
          <label>Nicho (opcional)</label>
          <input value={nicho} onChange={(e) => setNicho(e.target.value)} placeholder="ex: Barbearia" />
        </div>
        <div className="min-w-[160px] flex-1">
          <label>Cidade (opcional)</label>
          <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="ex: Campinas" />
        </div>
        <div className="min-w-[160px] flex-1">
          <label>Tags (separadas por vírgula)</label>
          <input value={tagsTexto} onChange={(e) => setTagsTexto(e.target.value)} placeholder="ex: reativação, q1" />
        </div>
      </div>

      <div className="box-header">
        <h2>2. Seleção de leads</h2>
      </div>
      <div className="mb-3 flex flex-wrap items-end gap-3">
        <div className="min-w-[140px]">
          <label>Nicho contém</label>
          <input value={filtroNicho} onChange={(e) => setFiltroNicho(e.target.value)} />
        </div>
        <div className="min-w-[140px]">
          <label>Cidade contém</label>
          <input value={filtroCidade} onChange={(e) => setFiltroCidade(e.target.value)} />
        </div>
        <div className="min-w-[160px]">
          <label>Status</label>
          <select value={filtroStatus} onChange={(e) => setFiltroStatus(e.target.value)}>
            {STATUS_LEAD_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
        <div className="w-28">
          <label>Score mín.</label>
          <input
            type="number"
            min={0}
            max={100}
            value={filtroScoreMin}
            onChange={(e) => setFiltroScoreMin(Number(e.target.value))}
          />
        </div>
        <button type="button" onClick={buscarLeads} className="btn-outline btn-sm" disabled={buscandoLeads}>
          {buscandoLeads ? "Buscando..." : "Buscar leads"}
        </button>
      </div>

      <div className="mb-2 flex items-center justify-between text-xs text-(--muted)">
        <span>
          {leadsEncontrados.length} lead(s) encontrados · <strong className="text-(--cyan)">{selecionados.size}</strong>{" "}
          selecionado(s) no total
        </span>
        <span className="flex gap-2">
          <button type="button" onClick={selecionarTodosFiltrados} className="btn-ghost btn-sm">
            Selecionar todos filtrados
          </button>
          <button type="button" onClick={limparSelecaoFiltrados} className="btn-ghost btn-sm">
            Limpar filtrados
          </button>
        </span>
      </div>

      <div className="table-wrap mb-6 max-h-80 overflow-y-auto">
        <table>
          <thead>
            <tr>
              <th></th>
              <th>Empresa</th>
              <th>Nicho</th>
              <th>Cidade</th>
              <th>Status</th>
              <th>Score</th>
              <th>Responsável</th>
            </tr>
          </thead>
          <tbody>
            {leadsEncontrados.map((l) => (
              <tr
                key={l.id}
                onClick={() => toggleLead(l.id)}
                className="cursor-pointer"
                style={selecionados.has(l.id) ? { background: "rgba(0,229,255,0.06)" } : undefined}
              >
                <td onClick={(e) => e.stopPropagation()}>
                  <input type="checkbox" checked={selecionados.has(l.id)} onChange={() => toggleLead(l.id)} />
                </td>
                <td className="font-medium text-white">{l.empresa}</td>
                <td className="text-(--text)">{l.nicho ?? "—"}</td>
                <td className="text-(--text)">{l.cidade ?? "—"}</td>
                <td className="text-(--text)">{l.status}</td>
                <td className="text-(--text)">{l.score}</td>
                <td className="text-(--text)">{l.responsavel_nome ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {leadsEncontrados.length === 0 && !buscandoLeads && (
          <p className="empty">Nenhum lead com responsável atende esse filtro.</p>
        )}
      </div>

      <div className="box-header">
        <h2>3. Mensagem</h2>
      </div>
      <div className="mb-2 flex flex-wrap gap-3">
        <div className="min-w-[220px] flex-1">
          <label>Modelo pronto (opcional)</label>
          <select value={templateId} onChange={(e) => aplicarTemplate(e.target.value)}>
            <option value="">Mensagem personalizada</option>
            {[...templatesPorEtapa.entries()].map(([stage, list]) => (
              <optgroup key={stage} label={stage}>
                {list.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </div>
      </div>
      <div className="mb-2">
        <label>Texto da mensagem</label>
        <textarea value={mensagem} onChange={(e) => setMensagem(e.target.value)} rows={3} />
        <p className="mt-1 text-xs text-(--muted)">Variáveis disponíveis: {PLACEHOLDER_HELP}</p>
      </div>
      {mensagem && (
        <div className="mb-6 rounded-md border border-(--border) bg-(--bg2) p-3 text-sm">
          <p className="mb-1 text-xs uppercase text-(--muted)">
            Pré-visualização {primeiroSelecionado ? `(${primeiroSelecionado.empresa})` : "(selecione um lead pra ver com dados reais)"}
          </p>
          <p className="whitespace-pre-wrap">{renderPreview(mensagem, primeiroSelecionado)}</p>
        </div>
      )}

      <div className="box-header">
        <h2>4. Follow-ups automáticos (opcional)</h2>
      </div>
      <p className="mb-2 text-xs text-(--muted)">
        Disparam sozinhos se o lead não responder e continuar como &quot;Novo&quot; depois de N dias do envio anterior.
      </p>
      <div className="mb-3 space-y-3">
        {followups.map((f, i) => (
          <div key={i} className="flex flex-wrap items-start gap-3">
            <div className="w-32">
              <label>Dias sem resposta</label>
              <input type="number" min={1} value={f.dias} onChange={(e) => updateFollowup(i, { dias: Number(e.target.value) })} />
            </div>
            <div className="min-w-[220px] flex-1">
              <label>Mensagem do follow-up</label>
              <textarea value={f.texto} onChange={(e) => updateFollowup(i, { texto: e.target.value })} rows={2} />
            </div>
            <button type="button" onClick={() => removeFollowup(i)} className="btn-ghost btn-sm mt-6">
              Remover
            </button>
          </div>
        ))}
      </div>
      <button type="button" onClick={addFollowup} className="btn-outline btn-sm mb-6">
        + Adicionar follow-up
      </button>

      <div className="box-header">
        <h2>5. Configurações de envio</h2>
      </div>
      <div className="mb-3 flex flex-wrap gap-3">
        <div className="w-32">
          <label>Intervalo mín. (s)</label>
          <input type="number" min={5} value={intervaloMin} onChange={(e) => setIntervaloMin(Number(e.target.value))} />
        </div>
        <div className="w-32">
          <label>Intervalo máx. (s)</label>
          <input type="number" min={5} value={intervaloMax} onChange={(e) => setIntervaloMax(Number(e.target.value))} />
        </div>
        <div className="w-32">
          <label>Limite diário</label>
          <input type="number" min={1} value={limiteDiario} onChange={(e) => setLimiteDiario(Number(e.target.value))} />
        </div>
        <div className="w-40">
          <label>Limite da campanha</label>
          <input
            type="number"
            min={0}
            value={limiteCampanha}
            onChange={(e) => setLimiteCampanha(Number(e.target.value))}
            placeholder="0 = sem limite"
          />
        </div>
      </div>
      <div className="mb-6 flex flex-wrap gap-6">
        <label className="flex items-center gap-2 text-sm text-(--text)">
          <input type="checkbox" checked={modoConservador} onChange={(e) => setModoConservador(e.target.checked)} />
          🐢 Modo conservador (dobra os intervalos)
        </label>
        <label className="flex items-center gap-2 text-sm text-(--text)">
          <input type="checkbox" checked={modoTeste} onChange={(e) => setModoTeste(e.target.checked)} />
          🧪 Modo teste (simula o envio, não manda WhatsApp de verdade)
        </label>
      </div>

      <button type="button" onClick={handleSubmit} disabled={creating} className="btn">
        {creating && <span className="loader" />}
        {creating ? "Criando..." : `Criar campanha (${selecionados.size} leads)`}
      </button>
    </div>
  );
}
