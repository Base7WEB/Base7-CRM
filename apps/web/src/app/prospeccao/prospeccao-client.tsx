"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

type Job = {
  id: string;
  requested_by: string;
  modo: string;
  params: Record<string, unknown> | null;
  status: string;
  erro: string | null;
  created_at: string;
  finished_at: string | null;
};

type JobLead = {
  id: string;
  empresa: string;
  telefone: string | null;
  endereco: string | null;
  nicho: string | null;
  cidade: string | null;
  instagram: string | null;
  site: string | null;
  email: string | null;
  rating_google: number | null;
  reviews_google: number | null;
  importado: boolean;
  lead_id: string | null;
  responsavel_atual: string | null;
};

const STATUS_BADGE: Record<string, string> = {
  PENDENTE: "badge-status",
  EM_ANDAMENTO: "badge-medium",
  CONCLUIDO: "badge-success",
  ERRO: "badge-hot",
};

const STATUS_LABEL: Record<string, string> = {
  PENDENTE: "Na fila",
  EM_ANDAMENTO: "Buscando agora",
  CONCLUIDO: "Concluído",
  ERRO: "Erro",
};

function resumoParams(job: Job): string {
  const p = job.params ?? {};
  if (job.modo === "maps") {
    return `${p.nicho ?? "?"} em ${p.cidade ?? "?"}${p.rating_min ? ` · nota ≥ ${p.rating_min}` : ""}`;
  }
  return `#${p.hashtag ?? "?"}`;
}

export function ProspeccaoClient({
  isAdmin,
  consultores,
  consultorInicial,
}: {
  isAdmin: boolean;
  consultores: { id: string; full_name: string }[];
  consultorInicial: string;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [modo, setModo] = useState<"maps" | "instagram">("maps");
  const [consultorAlvo, setConsultorAlvo] = useState(consultorInicial);

  const [nicho, setNicho] = useState("");
  const [cidade, setCidade] = useState("");
  const [raioKm, setRaioKm] = useState(10);
  const [ratingMin, setRatingMin] = useState(0);
  const [maxResultadosMaps, setMaxResultadosMaps] = useState(20);
  const [enriquecer, setEnriquecer] = useState(false);

  const [hashtag, setHashtag] = useState("");
  const [maxResultadosIg, setMaxResultadosIg] = useState(20);

  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [jobs, setJobs] = useState<Job[]>([]);
  const [nomesById, setNomesById] = useState<Map<string, string>>(new Map());
  const [jobSelecionado, setJobSelecionado] = useState<string | null>(null);
  const [resultados, setResultados] = useState<JobLead[]>([]);
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set());
  const [importando, setImportando] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadJobs = useCallback(async () => {
    const { data } = await supabase.from("scraper_jobs").select("*").order("created_at", { ascending: false }).limit(50);
    setJobs((data ?? []) as unknown as Job[]);

    if (isAdmin && data && data.length > 0) {
      const ids = [...new Set(data.map((j) => j.requested_by))];
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", ids);
      setNomesById(new Map((profiles ?? []).map((p) => [p.id, p.full_name])));
    }
  }, [supabase, isAdmin]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    const temPendente = jobs.some((j) => j.status === "PENDENTE" || j.status === "EM_ANDAMENTO");
    if (temPendente) {
      pollRef.current = setInterval(loadJobs, 4000);
    }
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [jobs, loadJobs]);

  async function handleBuscar() {
    setError(null);
    if (modo === "maps" && (!nicho.trim() || !cidade.trim())) {
      setError("Nicho e cidade são obrigatórios.");
      return;
    }
    if (modo === "instagram" && !hashtag.trim()) {
      setError("Hashtag é obrigatória.");
      return;
    }

    setEnviando(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      setError("Sessão expirada, recarregue a página.");
      setEnviando(false);
      return;
    }

    const params =
      modo === "maps"
        ? { nicho: nicho.trim(), cidade: cidade.trim(), raio_km: raioKm, rating_min: ratingMin, max_resultados: maxResultadosMaps, enriquecer }
        : { hashtag: hashtag.trim(), max_resultados: maxResultadosIg };

    const { error: err } = await supabase
      .from("scraper_jobs")
      .insert({ requested_by: consultorAlvo || user.id, modo, params });
    setEnviando(false);
    if (err) {
      setError(err.message);
      return;
    }
    await loadJobs();
  }

  async function abrirResultados(jobId: string) {
    setJobSelecionado(jobId);
    setSelecionados(new Set());
    const { data } = await supabase
      .from("scraper_job_leads")
      .select("*")
      .eq("job_id", jobId)
      .order("empresa", { ascending: true });
    setResultados(data ?? []);
  }

  function toggle(id: string) {
    setSelecionados((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selecionarTodosPendentes() {
    setSelecionados(new Set(resultados.filter((r) => !r.importado && !r.responsavel_atual).map((r) => r.id)));
  }

  async function handleImportar() {
    if (!jobSelecionado || selecionados.size === 0) return;
    setImportando(true);
    setError(null);
    const res = await fetch(`/api/scraper-jobs/${jobSelecionado}/import`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ job_lead_ids: [...selecionados] }),
    });
    const json = await res.json();
    setImportando(false);
    if (!res.ok) {
      setError(json.error ?? "Erro ao importar.");
      return;
    }
    await abrirResultados(jobSelecionado);
    setSelecionados(new Set());
  }

  const pendentesNoResultado = resultados.filter((r) => !r.importado && !r.responsavel_atual).length;
  const jaCadastradosNoResultado = resultados.filter((r) => !r.importado && r.responsavel_atual).length;

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Prospecção</h1>
          <p>Busca automática de leads via Google Maps ou Instagram, processada pelo scraper local do seu computador.</p>
        </div>
      </div>

      <div className="box">
        {isAdmin && consultores.length > 0 && (
          <div className="mb-4 min-w-[220px] max-w-xs">
            <label>Buscar para</label>
            <select value={consultorAlvo} onChange={(e) => setConsultorAlvo(e.target.value)}>
              <option value="">Eu mesmo</option>
              {consultores.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.full_name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-(--muted)">
              Os leads encontrados ficam atribuídos a essa pessoa -- só o <code>escutar-fila.bat</code> dela mesma processa
              o pedido (o token é individual).
            </p>
          </div>
        )}

        <div className="mb-3 flex gap-0 border-b border-(--border)">
          <button
            onClick={() => setModo("maps")}
            className={modo === "maps" ? "tab-btn ativo" : "tab-btn"}
          >
            Google Maps
          </button>
          <button
            onClick={() => setModo("instagram")}
            className={modo === "instagram" ? "tab-btn ativo" : "tab-btn"}
          >
            Instagram
          </button>
        </div>

        {modo === "maps" ? (
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[160px] flex-1">
              <label>Nicho</label>
              <input value={nicho} onChange={(e) => setNicho(e.target.value)} placeholder="ex: Barbearia" />
            </div>
            <div className="min-w-[160px] flex-1">
              <label>Cidade</label>
              <input value={cidade} onChange={(e) => setCidade(e.target.value)} placeholder="ex: Campinas, SP" />
            </div>
            <div className="w-28">
              <label>Raio (km)</label>
              <input type="number" min={1} value={raioKm} onChange={(e) => setRaioKm(Number(e.target.value))} />
            </div>
            <div className="w-32">
              <label>Nota mínima</label>
              <input type="number" min={0} max={5} step={0.5} value={ratingMin} onChange={(e) => setRatingMin(Number(e.target.value))} />
            </div>
            <div className="w-32">
              <label>Máx. resultados</label>
              <input type="number" min={1} value={maxResultadosMaps} onChange={(e) => setMaxResultadosMaps(Number(e.target.value))} />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-(--text)">
                <input type="checkbox" checked={enriquecer} onChange={(e) => setEnriquecer(e.target.checked)} />
                Tentar extrair e-mail do site
              </label>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <div className="min-w-[200px] flex-1">
              <label>Hashtag (sem #)</label>
              <input value={hashtag} onChange={(e) => setHashtag(e.target.value)} placeholder="ex: barbeariacampinas" />
            </div>
            <div className="w-32">
              <label>Máx. resultados</label>
              <input type="number" min={1} value={maxResultadosIg} onChange={(e) => setMaxResultadosIg(Number(e.target.value))} />
            </div>
            <p className="w-full text-xs text-(--muted)">Experimental — o Instagram exige login pra maioria dos conteúdos.</p>
          </div>
        )}

        {error && <p className="mt-3 text-sm text-(--danger)">{error}</p>}

        <button onClick={handleBuscar} disabled={enviando} className="btn mt-4">
          {enviando && <span className="loader" />}
          {enviando ? "Enviando..." : "Buscar"}
        </button>
        <p className="mt-2 text-xs text-(--muted)">
          Pra isso funcionar, o <code>escutar-fila.bat</code> (pasta <code>apps/scraper</code>) precisa estar aberto no seu computador.
        </p>
      </div>

      <div className="box">
        <div className="box-header">
          <h2>Buscas</h2>
        </div>
        {jobs.length === 0 ? (
          <p className="empty">Nenhuma busca ainda.</p>
        ) : (
          <div className="divide-y divide-(--border)">
            {jobs.map((job) => (
              <div key={job.id} className="py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-white">{resumoParams(job)}</p>
                    <p className="mt-1 flex items-center gap-2 text-xs text-(--muted)">
                      <span className={`badge ${STATUS_BADGE[job.status] ?? "badge-status"}`}>
                        {STATUS_LABEL[job.status] ?? job.status}
                      </span>
                      {job.modo === "maps" ? "Google Maps" : "Instagram"}
                      {isAdmin && ` · ${nomesById.get(job.requested_by) ?? "—"}`}
                      {" · "}
                      {new Date(job.created_at).toLocaleString("pt-BR")}
                    </p>
                    {job.status === "ERRO" && job.erro && <p className="mt-1 text-xs text-(--danger)">{job.erro}</p>}
                  </div>
                  {job.status === "CONCLUIDO" && (
                    <button onClick={() => abrirResultados(job.id)} className="btn-outline btn-sm shrink-0">
                      Ver resultados
                    </button>
                  )}
                </div>

                {jobSelecionado === job.id && (
                  <div className="mt-3 rounded-md border border-(--border) bg-(--bg2) p-3">
                    {resultados.length === 0 ? (
                      <p className="empty">Nenhum lead encontrado nessa busca.</p>
                    ) : (
                      <>
                        <div className="mb-2 flex items-center justify-between text-xs text-(--muted)">
                          <span>
                            {resultados.length} encontrado(s) · {pendentesNoResultado} pendente(s) de importação
                            {jaCadastradosNoResultado > 0 && ` · ${jaCadastradosNoResultado} já cadastrado(s)`} ·{" "}
                            <strong className="text-(--cyan)">{selecionados.size}</strong> selecionado(s)
                          </span>
                          <span className="flex gap-2">
                            <button onClick={selecionarTodosPendentes} className="btn-ghost btn-sm">
                              Selecionar todos pendentes
                            </button>
                            <button
                              onClick={handleImportar}
                              disabled={importando || selecionados.size === 0}
                              className="btn-sm bg-(--cyan)/15 text-(--cyan)"
                            >
                              {importando ? "Importando..." : `Importar (${selecionados.size})`}
                            </button>
                          </span>
                        </div>
                        <div className="table-wrap max-h-80 overflow-y-auto">
                          <table>
                            <thead>
                              <tr>
                                <th></th>
                                <th>Empresa</th>
                                <th>Endereço</th>
                                <th>Telefone</th>
                                <th>E-mail</th>
                                <th>Site</th>
                                <th>Nicho</th>
                                <th>Avaliação</th>
                                <th>Status</th>
                              </tr>
                            </thead>
                            <tbody>
                              {resultados.map((r) => (
                                <tr key={r.id}>
                                  <td>
                                    {r.importado ? (
                                      <span className="text-xs text-(--muted)">✓</span>
                                    ) : r.responsavel_atual ? (
                                      <span className="text-xs text-(--muted)" title="Já é lead de outro consultor, não dá pra importar">
                                        🔒
                                      </span>
                                    ) : (
                                      <input type="checkbox" checked={selecionados.has(r.id)} onChange={() => toggle(r.id)} />
                                    )}
                                  </td>
                                  <td className="font-medium text-white">{r.empresa}</td>
                                  <td className="text-xs text-(--muted)">{r.endereco ?? "—"}</td>
                                  <td className="text-(--text)">
                                    {r.telefone ? (
                                      <a
                                        href={`https://wa.me/${r.telefone.replace(/\D/g, "")}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="badge badge-success"
                                      >
                                        📲 {r.telefone}
                                      </a>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                  <td className="text-xs text-(--cyan)">{r.email ?? <span className="text-(--muted)">—</span>}</td>
                                  <td className="text-xs">
                                    {r.site ? (
                                      <a
                                        href={r.site.startsWith("http") ? r.site : `https://${r.site}`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-(--cyan) hover:underline"
                                      >
                                        🔗 Site
                                      </a>
                                    ) : (
                                      <span className="text-(--muted)">—</span>
                                    )}
                                  </td>
                                  <td className="text-(--text)">{r.nicho ?? "—"}</td>
                                  <td className="text-(--text)">
                                    {r.rating_google ? (
                                      <span className="text-(--warn)">
                                        ⭐ {r.rating_google.toFixed(1)}
                                        {r.reviews_google ? ` (${r.reviews_google})` : ""}
                                      </span>
                                    ) : (
                                      "—"
                                    )}
                                  </td>
                                  <td>
                                    {r.importado ? (
                                      r.lead_id ? (
                                        <Link href={`/leads/${r.lead_id}`} className="text-xs text-(--cyan) hover:underline">
                                          importado
                                        </Link>
                                      ) : (
                                        <span className="text-xs text-(--muted)">duplicado/rejeitado</span>
                                      )
                                    ) : r.responsavel_atual ? (
                                      <span className="text-xs text-(--warn)">já é lead de {r.responsavel_atual}</span>
                                    ) : (
                                      <span className="text-xs text-(--muted)">pendente</span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
