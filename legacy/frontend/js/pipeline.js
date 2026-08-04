const Pipeline = (() => {
  const COLUNAS = ["Novo","Contato","Reunião","Proposta","Negociação","Cliente","Perdido"];

  const COL_META = {
    "Novo":       { icon: "new",      cor: "#60a5fa" },
    "Contato":    { icon: "contact",  cor: "#00e5ff" },
    "Reunião":    { icon: "meeting",  cor: "#a78bfa" },
    "Proposta":   { icon: "proposal", cor: "#fbbf24" },
    "Negociação": { icon: "nego",     cor: "#f97316" },
    "Cliente":    { icon: "client",   cor: "#34d399" },
    "Perdido":    { icon: "lost",     cor: "#f87171" },
  };

  let arrastando = null;

  function render(leads) {
    const kanban = document.getElementById("kanban");
    if (!kanban) return;

    kanban.innerHTML = COLUNAS.map(col => {
      const cards = leads.filter(l => l.status === col);
      const valor = cards.reduce((a, b) => a + (b.valor || 0), 0);
      const meta  = COL_META[col];

      return `
        <div class="kanban-col"
             data-col="${col}"
             ondragover="Pipeline._dragOver(event)"
             ondrop="Pipeline._drop(event,'${col}')">

          <div class="kanban-col-header">
            <div class="kanban-col-header-left">
              <span style="color:${meta.cor}">${ic(meta.icon, 14)}</span>
              <h3>${col}</h3>
            </div>
            <span class="kanban-count">${cards.length}</span>
          </div>

          ${valor > 0 ? `<div class="kanban-valor">R$ ${valor.toLocaleString("pt-BR")}</div>` : ""}

          <div id="col-${col}">
            ${cards.length > 0 ? cards.map(l => _card(l)).join("") : _vazio()}
          </div>
        </div>`;
    }).join("");
  }

  function _diasNaEtapa(lead) {
    const ref = lead.statusChangedAt || lead.criadoEm || "";
    if (!ref) return 0;
    try {
      const d = new Date(ref);
      return Math.floor((Date.now() - d.getTime()) / 86400000);
    } catch (e) {
      return 0;
    }
  }

  function _agingBadge(dias, status) {
    if (status === "Cliente" || status === "Perdido") return "";
    if (dias === 0) return "";
    const cor   = dias >= 14 ? "var(--danger)" : dias >= 7 ? "var(--warn)" : "var(--muted)";
    const texto = dias === 1 ? "1 dia" : `${dias} dias`;
    return `<div class="lead-aging" style="color:${cor}">${ic('history',9)} ${texto} na etapa</div>`;
  }

  function _card(l) {
    const hoje     = new Date().toISOString().slice(0, 10);
    const fuVencido = l.followup && l.followup < hoje;
    const fuHoje    = l.followup && l.followup === hoje;
    const dias      = _diasNaEtapa(l);
    const tasksPend = (l.tasks || []).filter(t => !t.feito).length;

    return `
      <div class="lead-card"
           draggable="true"
           data-id="${l.id}"
           ondragstart="Pipeline._dragStart(event,'${l.id}')"
           onclick="CRM.abrirModalEditar('${l.id}')">
        <div class="lead-card-nome">${l.empresa}</div>
        <div class="lead-card-sub">${l.cidade || "—"}</div>
        ${(l.tags||[]).length > 0 ? `
          <div style="margin-bottom:6px">
            ${l.tags.slice(0,3).map(t => `<span class="tag-chip-mini" style="color:${_tagCor(t)};background:${_tagCor(t)}18;border:1px solid ${_tagCor(t)}33">${t}</span>`).join("")}
          </div>` : ""}
        <div class="lead-card-footer">
          ${CRM.scoreBadge(l.score || 0)}
          <div style="display:flex;flex-direction:column;align-items:flex-end;gap:3px">
            ${l.followup
              ? `<div class="lead-card-fu" style="color:${fuVencido ? "var(--danger)" : fuHoje ? "var(--warn)" : "var(--muted)"}">
                   ${ic('calendar', 10)} ${_fmtData(l.followup)}
                 </div>`
              : ""}
            ${tasksPend > 0 ? `<div style="font-size:10px;color:var(--cyan)">${ic('check',9)} ${tasksPend} tarefa${tasksPend>1?'s':''}</div>` : ""}
          </div>
        </div>
        ${_agingBadge(dias, l.status)}
      </div>`;
  }

  function _tagCor(tag) {
    const TAG_CORES = ["#00e5ff","#22c55e","#f59e0b","#a855f7","#ec4899","#ef4444","#2563eb","#f97316"];
    let h = 0;
    for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xffffffff;
    return TAG_CORES[Math.abs(h) % TAG_CORES.length];
  }

  function _vazio() {
    return `<div style="text-align:center;padding:24px 10px;color:#334155;font-size:12px">Solte aqui</div>`;
  }

  function _fmtData(iso) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  function _dragStart(e, id) {
    arrastando = id;
    e.dataTransfer.effectAllowed = "move";
  }

  function _dragOver(e) {
    e.preventDefault();
    e.currentTarget.classList.add("drag-over");
  }

  async function _drop(e, novoStatus) {
    e.preventDefault();
    document.querySelectorAll(".kanban-col").forEach(c => c.classList.remove("drag-over"));
    if (!arrastando) return;
    const lead = CRM.getLead(arrastando);
    if (!lead || lead.status === novoStatus) return;
    try {
      await Api.put(`/leads/${arrastando}`, { status: novoStatus });
      toast(`Movido para ${novoStatus}`, "info");
      await CRM.carregar();
    } catch (e) {
      toast("Erro ao mover lead: " + e.message, "error");
    }
    arrastando = null;
  }

  return { render, _dragStart, _dragOver, _drop };
})();
