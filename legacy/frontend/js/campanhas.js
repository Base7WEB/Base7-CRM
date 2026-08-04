const Campanhas = (() => {
  let leadsFiltrados = [];
  let selecionados   = new Set();
  let followups      = [];

  let _pollTimer = null;

  // ── Lista de campanhas ──────────────────────────────────────────────────
  async function render() {
    const cont = document.getElementById("wa-campanhas-conteudo");
    if (!cont) return;
    cont.innerHTML = `<p style="color:var(--muted)">Carregando campanhas...</p>`;
    try {
      const campanhas = await Api.get("/campaigns");
      cont.innerHTML = _renderLista(campanhas);
      _gerenciarPolling(campanhas.some(c => c.status === "Em execução"));
    } catch (e) {
      cont.innerHTML = `<p style="color:var(--danger)">Erro ao carregar campanhas: ${e.message}</p>`;
    }
  }

  function _gerenciarPolling(precisaPolling) {
    if (_pollTimer) { clearTimeout(_pollTimer); _pollTimer = null; }
    if (!precisaPolling) return;
    _pollTimer = setTimeout(() => {
      const painelVisivel = document.getElementById("wa-panel-campanhas")?.style.display !== "none";
      if (painelVisivel) render();
    }, 5000);
  }

  function _renderLista(campanhas) {
    const botaoNovo = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:16px">
        <button class="btn" onclick="Campanhas.abrirWizard()">
          <span class="ic" data-icon-name="plus" data-icon-size="14"></span> Nova Campanha
        </button>
      </div>`;

    if (!campanhas.length) {
      return botaoNovo + `<div class="box" style="text-align:center;color:var(--muted)">Nenhuma campanha criada ainda.</div>`;
    }

    return botaoNovo + campanhas.map(_renderCard).join("");
  }

  function _renderCard(c) {
    const podeIniciar = ["Rascunho", "Agendada"].includes(c.status);
    const podePausar  = c.status === "Em execução";
    const podeRetomar = c.status === "Pausada";
    const podeParar   = ["Em execução", "Pausada", "Agendada"].includes(c.status);

    const botoes = [];
    if (podeIniciar) botoes.push(`<button class="btn-sm btn-outline" onclick="Campanhas.iniciar('${c.id}')" title="Iniciar">${ic("play", 13)}</button>`);
    if (podePausar)  botoes.push(`<button class="btn-sm btn-outline" onclick="Campanhas.pausar('${c.id}')" title="Pausar">${ic("pause", 13)}</button>`);
    if (podeRetomar) botoes.push(`<button class="btn-sm btn-outline" onclick="Campanhas.retomar('${c.id}')" title="Retomar">${ic("play", 13)}</button>`);
    if (podeParar)   botoes.push(`<button class="btn-sm btn-outline" onclick="Campanhas.parar('${c.id}')" title="Parar">${ic("stop", 13)}</button>`);
    botoes.push(`<button class="btn-sm btn-ghost" onclick="Campanhas._toggleFila('${c.id}')" title="Ver fila">${ic("history", 13)}</button>`);
    botoes.push(`<button class="btn-sm btn-outline" onclick="Campanhas.excluir('${c.id}')" title="Excluir">${ic("trash", 13)}</button>`);

    return `
      <div class="box" style="margin-bottom:12px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
          <div>
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px">
              <strong>${c.nome}</strong>
              ${_badgeStatus(c.status)}
            </div>
            <p style="font-size:12px;color:var(--muted)">
              ${c.metricas.enviadas}/${c.leads.length} enviada(s) · ${c.metricas.respostas} resposta(s)
              · modo ${c.configuracoes.modo_teste ? "teste" : "real"}
            </p>
          </div>
          <div style="display:flex;gap:6px">${botoes.join("")}</div>
        </div>
        <div id="camp-fila-${c.id}" style="display:none;margin-top:12px;border-top:1px solid var(--border);padding-top:12px"></div>
      </div>`;
  }

  async function _toggleFila(id) {
    const el = document.getElementById(`camp-fila-${id}`);
    if (!el) return;
    if (el.style.display === "none" || !el.style.display) {
      el.style.display = "block";
      await _carregarFila(id);
    } else {
      el.style.display = "none";
    }
  }

  async function _carregarFila(id) {
    const el = document.getElementById(`camp-fila-${id}`);
    if (!el) return;
    el.innerHTML = `<p style="color:var(--muted);font-size:12px">Carregando fila...</p>`;
    try {
      const fila = await Api.get(`/campaigns/${id}/queue`);
      const leadsMap = {};
      CRM.getLeads().forEach(l => { leadsMap[l.id] = l.empresa; });
      el.innerHTML = fila.map(item => `
        <div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;font-size:12.5px">
          <span>${leadsMap[item.lead_id] || item.lead_id}</span>
          <span style="display:flex;align-items:center;gap:8px">
            <span style="color:var(--muted)">${item.status}${item.erro ? " — " + item.erro : ""}</span>
            ${item.status === "pendente" ? `<button class="btn-sm btn-ghost" onclick="Campanhas._pular('${id}','${item.lead_id}')" title="Pular">${ic("skip", 12)} Pular</button>` : ""}
          </span>
        </div>`).join("") || `<p style="color:var(--muted);font-size:12px">Fila vazia.</p>`;
    } catch (e) {
      el.innerHTML = `<p style="color:var(--danger);font-size:12px">Erro ao carregar fila: ${e.message}</p>`;
    }
  }

  async function _pular(campanhaId, leadId) {
    try {
      await Api.post(`/campaigns/${campanhaId}/queue/${leadId}/skip`, {});
      toast("Item pulado.", "info");
      await _carregarFila(campanhaId);
    } catch (e) {
      toast("Erro ao pular: " + e.message, "error");
    }
  }

  async function iniciar(id) {
    try { await Api.post(`/campaigns/${id}/start`, {}); toast("Campanha iniciada!", "success"); render(); }
    catch (e) { toast("Erro ao iniciar: " + e.message, "error"); }
  }

  async function pausar(id) {
    try { await Api.post(`/campaigns/${id}/pause`, {}); toast("Campanha pausada.", "info"); render(); }
    catch (e) { toast("Erro ao pausar: " + e.message, "error"); }
  }

  async function retomar(id) {
    try { await Api.post(`/campaigns/${id}/resume`, {}); toast("Campanha retomada!", "success"); render(); }
    catch (e) { toast("Erro ao retomar: " + e.message, "error"); }
  }

  async function parar(id) {
    if (!confirm("Parar esta campanha? Os envios pendentes não serão realizados.")) return;
    try { await Api.post(`/campaigns/${id}/stop`, {}); toast("Campanha parada.", "info"); render(); }
    catch (e) { toast("Erro ao parar: " + e.message, "error"); }
  }

  function _badgeStatus(status) {
    const cores = {
      "Rascunho":    "var(--muted)",
      "Agendada":    "var(--cyan)",
      "Em execução": "var(--success)",
      "Pausada":     "var(--warn)",
      "Finalizada":  "var(--success)",
      "Cancelada":   "var(--danger)",
    };
    const cor = cores[status] || "var(--muted)";
    return `<span class="badge" style="background:transparent;border-color:${cor};color:${cor}">${status}</span>`;
  }

  async function excluir(id) {
    if (!confirm("Excluir esta campanha? Essa ação não pode ser desfeita.")) return;
    try {
      await Api.del(`/campaigns/${id}`);
      toast("Campanha excluída.", "info");
      render();
    } catch (e) {
      toast("Erro ao excluir: " + e.message, "error");
    }
  }

  // ── Wizard ───────────────────────────────────────────────────────────────
  function abrirWizard() {
    selecionados = new Set();
    followups    = [];
    _limparCampos();
    _popularTemplates();
    filtrarLeads();
    _renderFollowups();
    document.getElementById("modal-campanha").classList.add("aberto");
    const primeiraTab = document.querySelector("#modal-campanha .tab-btn");
    if (primeiraTab) App.trocarTab(primeiraTab, "camp-passo-1");
  }

  function fecharWizard() {
    document.getElementById("modal-campanha")?.classList.remove("aberto");
  }

  function _limparCampos() {
    ["camp-nome", "camp-descricao", "camp-nicho", "camp-cidade", "camp-tags", "camp-mensagem"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    _val("camp-f-nicho", "");
    _val("camp-f-cidade", "");
    _val("camp-f-status", "");
    _val("camp-f-score", 0);
    _val("camp-intervalo-min", 20);
    _val("camp-intervalo-max", 60);
    _val("camp-limite-diario", 80);
    _val("camp-limite-campanha", 0);
    _chk("camp-modo-conservador", false);
    _chk("camp-modo-teste", false);
    _chk("camp-sel-todos", false);
  }

  function _val(id, v) { const el = document.getElementById(id); if (el) el.value = v; }
  function _chk(id, v) { const el = document.getElementById(id); if (el) el.checked = v; }

  function _popularTemplates() {
    const sel = document.getElementById("camp-template-select");
    const templates = CRM._getTemplates();
    const opcoes = ['<option value="">Mensagem personalizada</option>'];
    Object.keys(templates).forEach(etapa => {
      (templates[etapa] || []).forEach((t, i) => {
        opcoes.push(`<option value="${etapa}::${i}">${etapa} — ${t.nome}</option>`);
      });
    });
    sel.innerHTML = opcoes.join("");
  }

  function _selecionarTemplate() {
    const val = document.getElementById("camp-template-select").value;
    if (!val) return;
    const [etapa, idx] = val.split("::");
    const t = (CRM._getTemplates()[etapa] || [])[idx];
    if (t) {
      document.getElementById("camp-mensagem").value = t.texto;
      _atualizarPreview();
    }
  }

  function _atualizarPreview() {
    const texto   = document.getElementById("camp-mensagem").value;
    const todosLeads = CRM.getLeads();
    const leadPreview = todosLeads.find(l => selecionados.has(l.id)) || leadsFiltrados[0];
    const elLead  = document.getElementById("camp-preview-lead");
    const elTexto = document.getElementById("camp-preview-texto");

    if (!leadPreview) {
      elLead.textContent  = "Nenhum lead selecionado ainda.";
      elTexto.textContent = texto;
      return;
    }
    elLead.textContent = `Pré-visualizando para: ${leadPreview.empresa}`;
    elTexto.textContent = texto
      .replace(/{empresa}/g, leadPreview.empresa || "")
      .replace(/{responsavel}/g, leadPreview.responsavel || "")
      .replace(/{cidade}/g, leadPreview.cidade || "")
      .replace(/{nicho}/g, leadPreview.nicho || "")
      .replace(/{rating}/g, leadPreview.rating_google || "")
      .replace(/{site}/g, leadPreview.site || "")
      .replace(/{instagram}/g, leadPreview.instagram || "");
  }

  // ── Passo 2: filtro/seleção de leads ────────────────────────────────────
  function filtrarLeads() {
    const nicho  = (document.getElementById("camp-f-nicho").value || "").toLowerCase();
    const cidade = (document.getElementById("camp-f-cidade").value || "").toLowerCase();
    const status = document.getElementById("camp-f-status").value;
    const score  = parseInt(document.getElementById("camp-f-score").value) || 0;

    leadsFiltrados = CRM.getLeads().filter(l => {
      if (!l.telefone) return false;
      if (nicho && !(l.nicho || "").toLowerCase().includes(nicho)) return false;
      if (cidade && !(l.cidade || "").toLowerCase().includes(cidade)) return false;
      if (status && l.status !== status) return false;
      if (score && (l.score || 0) < score) return false;
      return true;
    });

    _renderTabelaLeads();
  }

  function _renderTabelaLeads() {
    const tbody = document.getElementById("camp-tabela-leads");
    tbody.innerHTML = leadsFiltrados.map(l => `
      <tr>
        <td><input type="checkbox" ${selecionados.has(l.id) ? "checked" : ""} onchange="Campanhas._toggleLead('${l.id}', this.checked)"></td>
        <td>${l.empresa}</td>
        <td>${l.cidade || "—"}</td>
        <td>${l.status}</td>
        <td>${l.score || 0}</td>
      </tr>`).join("") ||
      `<tr><td colspan="5" style="text-align:center;color:var(--muted)">Nenhum lead com telefone corresponde aos filtros.</td></tr>`;
    _atualizarContadorSelecao();
  }

  function _toggleLead(id, checked) {
    if (checked) selecionados.add(id); else selecionados.delete(id);
    _atualizarContadorSelecao();
  }

  function selecionarTodosFiltrados(checked) {
    leadsFiltrados.forEach(l => { if (checked) selecionados.add(l.id); else selecionados.delete(l.id); });
    _renderTabelaLeads();
  }

  function _atualizarContadorSelecao() {
    const el = document.getElementById("camp-sel-count");
    if (el) el.textContent = `${selecionados.size} lead(s) selecionado(s)`;
  }

  // ── Passo 4: follow-ups ──────────────────────────────────────────────────
  function _addFollowup() {
    followups.push({ dias: 3, texto: "Olá {empresa}! Só passando para saber se viu minha mensagem anterior." });
    _renderFollowups();
  }

  function _removerFollowup(i) {
    followups.splice(i, 1);
    _renderFollowups();
  }

  function _atualizarFollowupDias(i, v)  { if (followups[i]) followups[i].dias  = parseInt(v) || 1; }
  function _atualizarFollowupTexto(i, v) { if (followups[i]) followups[i].texto = v; }

  function _renderFollowups() {
    const cont = document.getElementById("camp-followups-lista");
    cont.innerHTML = followups.map((f, i) => `
      <div class="box" style="margin-bottom:10px">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px">
          <label style="margin:0;font-size:12px">Após</label>
          <input type="number" min="1" value="${f.dias}" style="width:60px" onchange="Campanhas._atualizarFollowupDias(${i}, this.value)">
          <label style="margin:0;font-size:12px">dia(s) sem resposta</label>
          <button class="btn-sm btn-ghost" style="margin-left:auto" onclick="Campanhas._removerFollowup(${i})">
            <span class="ic" data-icon-name="trash" data-icon-size="13"></span>
          </button>
        </div>
        <textarea rows="2" style="width:100%" onchange="Campanhas._atualizarFollowupTexto(${i}, this.value)">${f.texto}</textarea>
      </div>`).join("") ||
      `<p style="color:var(--muted);font-size:12.5px">Nenhum follow-up automático configurado.</p>`;
  }

  // ── Passo 6: revisão + criação ────────────────────────────────────────────
  function _renderRevisao() {
    const nome     = document.getElementById("camp-nome").value.trim();
    const mensagem = document.getElementById("camp-mensagem").value.trim();
    const cont = document.getElementById("camp-revisao-conteudo");
    cont.innerHTML = `
      <div class="box">
        <p><strong>${nome || "(sem nome)"}</strong></p>
        <p style="color:var(--muted);font-size:12.5px;margin-top:4px">
          ${selecionados.size} lead(s) selecionado(s) · ${followups.length} follow-up(s) configurado(s)
        </p>
        <p style="margin-top:10px;font-size:13px;white-space:pre-wrap">${mensagem || "(mensagem vazia)"}</p>
      </div>`;
  }

  async function criar() {
    const nome     = document.getElementById("camp-nome").value.trim();
    const mensagem = document.getElementById("camp-mensagem").value.trim();

    if (!nome)                    { toast("Informe o nome da campanha no passo 1.", "error"); return; }
    if (selecionados.size === 0)  { toast("Selecione ao menos um lead no passo 2.", "error");  return; }
    if (!mensagem)                { toast("Escreva a mensagem no passo 3.", "error");          return; }

    const dados = {
      nome,
      descricao: document.getElementById("camp-descricao").value.trim(),
      nicho:     document.getElementById("camp-nicho").value.trim(),
      cidade:    document.getElementById("camp-cidade").value.trim(),
      tags:      document.getElementById("camp-tags").value.split(",").map(t => t.trim()).filter(Boolean),
      leads:     Array.from(selecionados),
      template:  { nome: "Mensagem da campanha", texto: mensagem },
      followups: followups,
      configuracoes: {
        intervalo_min_seg: parseInt(document.getElementById("camp-intervalo-min").value) || 20,
        intervalo_max_seg: parseInt(document.getElementById("camp-intervalo-max").value) || 60,
        limite_diario:     parseInt(document.getElementById("camp-limite-diario").value) || 80,
        limite_campanha:   parseInt(document.getElementById("camp-limite-campanha").value) || selecionados.size,
        modo_conservador:  document.getElementById("camp-modo-conservador").checked,
        modo_teste:        document.getElementById("camp-modo-teste").checked,
      },
    };

    try {
      await Api.post("/campaigns", dados);
      toast("Campanha criada como rascunho!", "success");
      fecharWizard();
      render();
    } catch (e) {
      toast("Erro ao criar campanha: " + e.message, "error");
    }
  }

  return {
    render, excluir, abrirWizard, fecharWizard,
    filtrarLeads, selecionarTodosFiltrados, _toggleLead,
    _selecionarTemplate, _atualizarPreview,
    _addFollowup, _removerFollowup, _atualizarFollowupDias, _atualizarFollowupTexto,
    criar, _renderRevisao,
    iniciar, pausar, retomar, parar, _toggleFila, _pular,
  };
})();
