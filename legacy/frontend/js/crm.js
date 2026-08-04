const CRM = (() => {
  let leads      = [];
  let ordenacao  = { col: "empresa", asc: true };
  let editandoId = null;

  const CORES_ORIG = ["#2563eb","#00e5ff","#22c55e","#f59e0b","#a855f7","#ec4899"];

  const COL_ICON = {
    "Novo":"new","Contato":"contact","Reunião":"meeting",
    "Proposta":"proposal","Negociação":"nego","Cliente":"client","Perdido":"lost",
  };

  // Templates WhatsApp padrão por estágio
  const WA_TEMPLATES_DEFAULT = {
    "Novo":       [
      { nome: "Apresentação", texto: "Olá {empresa}! 👋 Vi o seu negócio e adorei. Sou especialista em [seu serviço] e acredito que posso agregar muito valor ao seu negócio. Podemos conversar 5 minutos?" },
      { nome: "Curiosidade",  texto: "Oi {empresa}, tudo bem? Estou entrando em contato porque tenho alguns clientes do mesmo segmento que você e os resultados têm sido incríveis. Posso te mostrar?" },
    ],
    "Contato":    [
      { nome: "Follow-up",    texto: "Olá {empresa}! Fiz contato há alguns dias sobre [serviço]. Gostaria de saber se tiveram a oportunidade de pensar sobre isso. Posso ajudar com alguma informação?" },
      { nome: "Reunião",      texto: "Oi {empresa}! Que tal agendarmos uma reunião rápida de 20 minutos? Posso mostrar como empresas similares estão aumentando seus resultados." },
    ],
    "Reunião":    [
      { nome: "Confirmação",  texto: "Olá {empresa}! Passando para confirmar nossa reunião de amanhã. Vou preparar uma apresentação personalizada para o seu negócio. Até lá!" },
      { nome: "Pós-reunião",  texto: "Foi um prazer conversar com você, {empresa}! Conforme combinado, vou preparar a proposta e te envio em breve. Qualquer dúvida, estou à disposição!" },
    ],
    "Proposta":   [
      { nome: "Envio",        texto: "Olá {empresa}! Acabei de enviar a proposta por e-mail. Você conseguiu receber? Posso tirar alguma dúvida sobre os valores ou a proposta?" },
      { nome: "Follow-up",    texto: "Oi {empresa}! Passando para verificar se puderam analisar a proposta. Há alguma objeção que eu possa ajudar a esclarecer?" },
    ],
    "Negociação": [
      { nome: "Condições",    texto: "Olá {empresa}! Para fecharmos, podemos ajustar as condições de pagamento conforme sua necessidade. O que seria mais conveniente para vocês?" },
      { nome: "Urgência",     texto: "Oi {empresa}! Só para reforçar que essa condição especial é válida até [data]. Não quero que percam essa oportunidade!" },
    ],
    "Cliente":    [
      { nome: "Boas-vindas",  texto: "Seja muito bem-vindo, {empresa}! 🎉 É um prazer ter vocês como clientes. Em breve entro em contato com os próximos passos do onboarding." },
      { nome: "Indicação",    texto: "Olá {empresa}! Espero que estejam satisfeitos com os resultados! Caso conheçam outros negócios que possam se beneficiar, ficaremos honrados com uma indicação." },
    ],
    "Perdido":    [
      { nome: "Reativação",   texto: "Olá {empresa}! Faz um tempo que não conversamos. Passando para ver se algo mudou e se posso ajudar de alguma forma agora." },
    ],
  };

  let _templatesCache = null;

  async function carregarTemplates() {
    try {
      const remoto = await Api.get("/templates");
      if (remoto && Object.keys(remoto).length > 0) {
        _templatesCache = remoto;
        return;
      }
    } catch (e) { /* backend pode estar iniciando; segue para o fallback abaixo */ }

    // Backend ainda sem templates configurados: migra do localStorage (versões
    // anteriores do CRM guardavam os templates só no navegador) ou usa o padrão.
    const salvoLocal = localStorage.getItem("base7-wa-templates");
    _templatesCache  = salvoLocal ? JSON.parse(salvoLocal) : WA_TEMPLATES_DEFAULT;
    try {
      await Api.post("/templates", _templatesCache);
      localStorage.removeItem("base7-wa-templates");
    } catch (e) { /* sem backend disponível agora; tenta migrar na próxima carga */ }
  }

  function _getTemplates() {
    return _templatesCache || WA_TEMPLATES_DEFAULT;
  }

  async function salvarTemplates(tpl) {
    _templatesCache = tpl;
    try {
      await Api.post("/templates", tpl);
      toast("Templates salvos!", "success");
    } catch (e) {
      toast("Erro ao salvar templates: " + e.message, "error");
    }
  }

  // ── Dados ──────────────────────────────────────────────────────────────────
  async function carregar() {
    try {
      leads = await Api.get("/leads");
      renderDashboard();
      renderTabela();
      Pipeline.render(leads);
    } catch (e) {
      toast("Erro ao carregar leads: " + e.message, "error");
    }
  }

  function getLead(id)  { return leads.find(l => l.id === id); }
  function getLeads()   { return leads; }

  // ── Score badge ────────────────────────────────────────────────────────────
  function scoreBadge(score) {
    if (score >= 70) return `<span class="badge badge-hot">${ic('star',10)} Quente</span>`;
    if (score >= 40) return `<span class="badge badge-medium">${ic('trending',10)} Médio</span>`;
    return `<span class="badge badge-cold">${ic('alert',10)} Frio</span>`;
  }

  // ── Dashboard ──────────────────────────────────────────────────────────────
  async function renderDashboard() {
    const hoje = new Date().toISOString().slice(0, 10);
    const mesAtual = new Date().toISOString().slice(0, 7);

    const total = leads.length;
    const novos = leads.filter(l => l.status === "Novo").length;
    const neg   = leads.filter(l => l.status === "Negociação").length;
    const cli   = leads.filter(l => l.status === "Cliente").length;
    const pot   = leads.reduce((a, b) => a + (b.valor || 0), 0);
    const conv  = total > 0 ? Math.round((cli / total) * 100) : 0;
    const fu    = leads.filter(l => l.followup === hoje).length;

    _set("st-total", total);
    _set("st-novos", novos);
    _set("st-neg",   neg);
    _set("st-cli",   cli);
    _set("st-pot",   "R$ " + pot.toLocaleString("pt-BR"));
    _set("st-conv",  conv + "%");
    _set("st-fu",    fu);

    _set("dash-data", new Date().toLocaleDateString("pt-BR", {
      weekday: "long", day: "2-digit", month: "long", year: "numeric"
    }));

    _renderFunil();
    _renderFollowupsHoje(hoje);
    _renderRecentes();
    _renderOrigem();
    await _renderMeta(mesAtual);
  }

  async function _renderMeta(mesAtual) {
    const elBar  = document.getElementById("meta-bar");
    const elPct  = document.getElementById("meta-pct");
    const elVal  = document.getElementById("meta-valores");
    if (!elBar) return;

    try {
      const meta      = await Api.get("/meta");
      const fechados  = leads.filter(l => l.status === "Cliente" && (l.atualizadoEm || "").slice(0,7) === mesAtual);
      const realizado = fechados.reduce((a, b) => a + (b.valor || 0), 0);
      const objetivo  = meta.valor || 0;
      const pct       = objetivo > 0 ? Math.min(Math.round((realizado / objetivo) * 100), 100) : 0;

      elBar.style.width = pct + "%";
      elBar.style.background = pct >= 100
        ? "linear-gradient(90deg,#22c55e,#4ade80)"
        : pct >= 70
          ? "linear-gradient(90deg,#f59e0b,#fbbf24)"
          : "linear-gradient(90deg,#2563eb,#00e5ff)";

      if (elPct) elPct.textContent = pct + "%";
      if (elVal) elVal.textContent = `R$ ${realizado.toLocaleString("pt-BR")} de R$ ${objetivo.toLocaleString("pt-BR")}`;

      const elMetaBox = document.getElementById("meta-box");
      if (elMetaBox) elMetaBox.style.display = objetivo > 0 ? "block" : "none";
    } catch (e) { /* silencioso */ }
  }

  function _renderFunil() {
    const STATUS = ["Novo","Contato","Reunião","Proposta","Negociação","Cliente","Perdido"];
    const el = document.getElementById("funil-bars");
    if (!el) return;

    const counts = STATUS.map(s => leads.filter(l => l.status === s).length);
    const max    = Math.max(...counts, 1);

    el.innerHTML = STATUS.map((s, i) => {
      const count = counts[i];
      const pct   = Math.round((count / max) * 100);
      const valor = leads.filter(l => l.status === s).reduce((a, b) => a + (b.valor || 0), 0);
      return `
        <div class="funil-row">
          <div class="funil-label">${ic(COL_ICON[s] || 'leads', 14)} ${s}</div>
          <div class="funil-bar-wrap"><div class="funil-bar" style="width:${pct}%"></div></div>
          <div class="funil-count">${count}</div>
          <div class="funil-valor">${valor > 0 ? "R$ " + valor.toLocaleString("pt-BR") : "—"}</div>
        </div>`;
    }).join("");
  }

  function _renderFollowupsHoje(hoje) {
    const fuHoje = leads.filter(l => l.followup === hoje);
    const el     = document.getElementById("followups-hoje");
    const cnt    = document.getElementById("fu-hoje-count");
    if (cnt) cnt.textContent = fuHoje.length > 0 ? `${fuHoje.length} pendente(s)` : "";
    if (!el) return;

    if (fuHoje.length === 0) {
      el.innerHTML = `<div class="empty"><div class="ei">${ICON.check}</div><p>Nenhum follow-up para hoje.</p></div>`;
      return;
    }
    el.innerHTML = fuHoje.map(l => `
      <div class="followup-item followup-hoje" style="cursor:pointer" onclick="CRM.abrirModalEditar('${l.id}')">
        <div>
          <div class="empresa">${l.empresa}</div>
          <div style="font-size:11px;color:var(--muted)">${l.nicho || ""} ${l.cidade ? "· " + l.cidade : ""}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${scoreBadge(l.score || 0)}
          <button class="btn-sm btn-ghost" onclick="event.stopPropagation();CRM.abrirModalEditar('${l.id}')">Abrir</button>
        </div>
      </div>`).join("");
  }

  function _renderRecentes() {
    const recentes = [...leads]
      .sort((a, b) => (b.criadoEm || "").localeCompare(a.criadoEm || ""))
      .slice(0, 6);
    const el = document.getElementById("leads-recentes");
    if (!el) return;

    if (recentes.length === 0) {
      el.innerHTML = `<div class="empty"><div class="ei">${ICON.leads}</div><p>Nenhum lead cadastrado ainda.</p></div>`;
      return;
    }
    el.innerHTML = recentes.map(l => `
      <div class="recente-item" onclick="CRM.abrirModalEditar('${l.id}')">
        <div>
          <div class="recente-nome">${l.empresa}</div>
          <div class="recente-sub">${[l.nicho, l.cidade].filter(Boolean).join(" · ")}</div>
        </div>
        <div style="display:flex;align-items:center;gap:8px">
          ${scoreBadge(l.score || 0)}
          <span class="badge badge-status" style="font-size:10px">${l.status}</span>
        </div>
      </div>`).join("");
  }

  function _renderOrigem() {
    const ORIGENS = ["Google Maps","Google","Instagram","Indicação","Prospecção ativa","Manual"];
    const el = document.getElementById("origem-dist");
    if (!el || leads.length === 0) {
      if (el) el.innerHTML = `<div class="empty"><div class="ei">${ICON.chart}</div><p>Sem dados ainda.</p></div>`;
      return;
    }
    const comLeads = ORIGENS.filter(o => leads.filter(l => l.origem === o).length > 0);
    const maxQ = Math.max(...comLeads.map(o => leads.filter(l => l.origem === o).length), 1);

    el.innerHTML = comLeads.map((o, i) => {
      const count   = leads.filter(l => l.origem === o).length;
      const pct     = Math.round((count / leads.length) * 100);
      const barPct  = Math.round((count / maxQ) * 100);
      const cor     = CORES_ORIG[i % CORES_ORIG.length];
      return `
        <div class="origem-row">
          <div class="origem-header">
            <div class="origem-nome"><span class="origem-dot" style="background:${cor}"></span>${o}</div>
            <div class="origem-pct">${count} lead${count !== 1 ? "s" : ""} · ${pct}%</div>
          </div>
          <div class="origem-bar-wrap"><div class="origem-bar" style="width:${barPct}%;background:${cor}"></div></div>
        </div>`;
    }).join("");
  }

  // ── Tabela ─────────────────────────────────────────────────────────────────
  function renderTabela() {
    const busca   = (document.getElementById("busca")?.value || "").toLowerCase();
    const stFilt  = document.getElementById("filtro-status")?.value || "";
    const orFilt  = document.getElementById("filtro-origem")?.value || "";
    const tagFilt = (document.getElementById("filtro-tag")?.value || "").toLowerCase();

    let filtrados = leads.filter(l => {
      const txt = (l.empresa + " " + (l.responsavel || "")).toLowerCase();
      if (busca && !txt.includes(busca)) return false;
      if (stFilt && l.status !== stFilt) return false;
      if (orFilt && l.origem !== orFilt) return false;
      if (tagFilt) {
        const tags = (l.tags || []).map(t => t.toLowerCase());
        if (!tags.some(t => t.includes(tagFilt))) return false;
      }
      return true;
    });

    filtrados.sort((a, b) => {
      const va = a[ordenacao.col] ?? "";
      const vb = b[ordenacao.col] ?? "";
      return typeof va === "number"
        ? (ordenacao.asc ? va - vb : vb - va)
        : (ordenacao.asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va)));
    });

    _set("leads-count", `${filtrados.length} lead${filtrados.length !== 1 ? "s" : ""}`);

    const tbody = document.getElementById("tabela-leads");
    if (filtrados.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty"><div class="ei">${ICON.leads}</div><p>Nenhum lead encontrado.</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = filtrados.map(l => `
      <tr>
        <td>
          <strong style="font-size:13.5px">${l.empresa}</strong>
          ${l.responsavel ? `<br><span style="font-size:11px;color:var(--muted)">${l.responsavel}</span>` : ""}
          ${(l.tags||[]).length > 0 ? `<div style="margin-top:4px">${l.tags.map(t => `<span class="tag-chip" style="background:${_tagCor(t)}20;color:${_tagCor(t)};border:1px solid ${_tagCor(t)}40">${t}</span>`).join("")}</div>` : ""}
        </td>
        <td style="font-size:12.5px;color:var(--muted)">${l.nicho || "—"}</td>
        <td style="font-size:12.5px;color:var(--muted)">${l.cidade || "—"}</td>
        <td><span class="badge badge-status" style="font-size:11px">${l.status}</span></td>
        <td>${scoreBadge(l.score || 0)}</td>
        <td style="font-size:12.5px;color:var(--muted)">${l.followup ? _fmtData(l.followup) : "—"}</td>
        <td style="font-size:11px;color:var(--muted);max-width:160px" title="${l.proxima_acao||''}">${l.proxima_acao ? l.proxima_acao.slice(0,50) + (l.proxima_acao.length>50?"…":"") : "—"}</td>
        <td>
          <div class="td-acoes">
            <button title="Editar" onclick="CRM.abrirModalEditar('${l.id}')">${ic('edit',15)}</button>
            ${l.telefone ? `<button class="btn-wa" title="WhatsApp" onclick="CRM.abrirTemplatesWA('${l.id}')">${ic('whatsapp',15)}</button>` : ""}
            <button class="btn-del" title="Excluir" onclick="CRM.excluir('${l.id}')">${ic('trash',15)}</button>
          </div>
        </td>
      </tr>`).join("");
  }

  function _fmtData(iso) {
    const [y, m, d] = iso.split("-");
    return `${d}/${m}/${y}`;
  }

  const TAG_CORES = ["#00e5ff","#22c55e","#f59e0b","#a855f7","#ec4899","#ef4444","#2563eb","#f97316"];
  function _tagCor(tag) {
    let h = 0;
    for (let i = 0; i < tag.length; i++) h = (h * 31 + tag.charCodeAt(i)) & 0xffffffff;
    return TAG_CORES[Math.abs(h) % TAG_CORES.length];
  }

  // ── WhatsApp Templates ─────────────────────────────────────────────────────
  function abrirTemplatesWA(id) {
    const l = getLead(id);
    if (!l || !l.telefone) return;

    const templates = _getTemplates();
    const lista     = templates[l.status] || templates["Novo"] || [];
    const conectado = typeof Whatsapp !== "undefined" && Whatsapp.conectado();

    const modal = document.getElementById("modal-wa-templates");
    const cont  = document.getElementById("wa-templates-lista");
    document.getElementById("wa-template-titulo").textContent = `Templates — ${l.status} (${l.empresa})`;

    cont.innerHTML = lista.map((t, i) => {
      const textoRenderizado = t.texto.replace(/{empresa}/g, l.empresa);
      const textoEncoded     = encodeURIComponent(textoRenderizado);
      return `
      <div class="wa-template-item">
        <div onclick="CRM._enviarTemplate('${l.telefone}','${textoEncoded}')" style="cursor:pointer">
          <div class="wa-template-nome">${t.nome}</div>
          <div class="wa-template-texto">${textoRenderizado}</div>
        </div>
        ${conectado ? `
        <button class="btn-sm btn-outline" style="margin-top:8px;width:100%" onclick="CRM._enviarViaAutomacao('${id}','${textoEncoded}')">
          ${ic('whatsapp',13)} Enviar via automação
        </button>` : ""}
      </div>`;
    }).join("") ||
      `<p style="color:var(--muted);font-size:13px">Nenhum template para "${l.status}".<br>Edite os templates em Configurações → Templates WhatsApp.</p>`;

    // Botão WhatsApp direto (sem template)
    cont.innerHTML += `
      <div style="margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">
        <button class="btn-outline" style="width:100%" onclick="CRM.whatsapp('${l.telefone}')">
          ${ic('whatsapp',14)} Abrir sem template
        </button>
      </div>`;

    modal.classList.add("aberto");
  }

  function _enviarTemplate(telefone, textoEncoded) {
    const texto = decodeURIComponent(textoEncoded);
    const num   = telefone.replace(/\D/g, "");
    window.open(`https://wa.me/55${num}?text=${encodeURIComponent(texto)}`, "_blank");
    fecharModalWA();
  }

  async function _enviarViaAutomacao(id, textoEncoded) {
    const texto = decodeURIComponent(textoEncoded);
    try {
      await Api.post("/whatsapp/send", { lead_id: id, texto });
      toast("Mensagem enviada via WhatsApp!", "success");
      fecharModalWA();
      await carregar();
    } catch (e) {
      let msg = e.message;
      try { msg = JSON.parse(e.message).erro || msg; } catch { /* mensagem já é texto simples */ }
      toast("Erro ao enviar: " + msg, "error");
    }
  }

  function fecharModalWA() {
    document.getElementById("modal-wa-templates")?.classList.remove("aberto");
  }

  // ── Modal Lead ─────────────────────────────────────────────────────────────
  function abrirModalNovo() {
    editandoId = null;
    limparForm();
    _set("modal-titulo", "Novo Lead");
    document.getElementById("tab-hist-btn").style.display = "none";
    document.getElementById("tab-tasks-btn").style.display = "none";
    document.getElementById("tab-ia-btn").style.display = "none";
    document.querySelector('[onclick="App.trocarTab(this,\'tab-dados\')"]').click();
    document.getElementById("modal-lead").classList.add("aberto");
  }

  function abrirModalEditar(id) {
    const l = getLead(id);
    if (!l) return;
    editandoId = id;

    _set("modal-titulo", "Editar Lead");
    document.getElementById("tab-hist-btn").style.display = "";
    document.getElementById("tab-tasks-btn").style.display = "";
    document.getElementById("tab-ia-btn").style.display = "";

    _val("lead-id",      l.id);
    _val("f-empresa",    l.empresa || "");
    _val("f-responsavel",l.responsavel || "");
    _val("f-nicho",      l.nicho || "");
    _val("f-cidade",     l.cidade || "");
    _val("f-endereco",   l.endereco || "");
    _val("f-telefone",   l.telefone || "");
    _val("f-instagram",  l.instagram || "");
    _val("f-site",       l.site || "");
    _val("f-email",      l.email || "");
    _val("f-valor",      l.valor || "");
    _val("f-origem",     l.origem || "Manual");
    _val("f-status",     l.status || "Novo");
    _val("f-followup",   l.followup || "");
    _val("f-rating",     l.rating_google || "");
    _val("f-reviews",    l.reviews_google || "");
    _val("f-obs",        l.obs || "");

    _renderTagsInput(l.tags || []);
    renderHistorico(l.historico || []);
    _renderTasks(l.tasks || []);
    _limparPainelIA();

    // Badge de tarefas pendentes
    const tasksPendentes = (l.tasks || []).filter(t => !t.feito).length;
    const taskBtn        = document.getElementById("tab-tasks-btn");
    if (taskBtn) taskBtn.textContent = tasksPendentes > 0
      ? `Tarefas (${tasksPendentes})`
      : "Tarefas";

    document.querySelector('[onclick="App.trocarTab(this,\'tab-dados\')"]').click();
    document.getElementById("modal-lead").classList.add("aberto");
  }

  function fecharModal() {
    document.getElementById("modal-lead").classList.remove("aberto");
    editandoId = null;
  }

  function limparForm() {
    ["lead-id","f-empresa","f-responsavel","f-nicho","f-cidade","f-endereco",
     "f-telefone","f-instagram","f-site","f-email","f-valor","f-followup",
     "f-rating","f-reviews","f-obs"].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = "";
    });
    _val("f-origem", "Manual");
    _val("f-status", "Novo");
    _renderTagsInput([]);
    _renderTasks([]);
    _limparPainelIA();
  }

  // ── Tags ───────────────────────────────────────────────────────────────────
  let _tagsAtuais = [];

  function _renderTagsInput(tags) {
    _tagsAtuais = [...tags];
    _atualizarTagsUI();
  }

  function _atualizarTagsUI() {
    const wrap = document.getElementById("tags-chips-wrap");
    if (!wrap) return;
    wrap.innerHTML = _tagsAtuais.map((t, i) => `
      <span class="tag-chip" style="background:${_tagCor(t)}22;color:${_tagCor(t)};border:1px solid ${_tagCor(t)}44">
        ${t}
        <button class="tag-chip-rm" onclick="CRM._removerTag(${i})">×</button>
      </span>`).join("");
  }

  function _removerTag(idx) {
    _tagsAtuais.splice(idx, 1);
    _atualizarTagsUI();
  }

  function _adicionarTag() {
    const inp = document.getElementById("tag-input");
    if (!inp) return;
    const val = inp.value.trim();
    if (!val || _tagsAtuais.includes(val)) { inp.value = ""; return; }
    _tagsAtuais.push(val);
    inp.value = "";
    _atualizarTagsUI();
  }

  function _tagInputKeydown(e) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      _adicionarTag();
    }
  }

  // Tags rápidas pré-definidas
  const TAGS_RAPIDAS = ["VIP","Urgente","Quente","Desconto","Indicação","Segurança","Sem resposta"];
  function _renderTagsRapidas() {
    const el = document.getElementById("tags-rapidas");
    if (!el) return;
    el.innerHTML = TAGS_RAPIDAS.map(t => `
      <button type="button" class="tag-chip-btn" onclick="CRM._addTagRapida('${t}')">${t}</button>`).join("");
  }

  function _addTagRapida(tag) {
    if (!_tagsAtuais.includes(tag)) {
      _tagsAtuais.push(tag);
      _atualizarTagsUI();
    }
  }

  // ── Tasks ──────────────────────────────────────────────────────────────────
  let _tasksAtuais = [];

  function _renderTasks(tasks) {
    _tasksAtuais = tasks.map(t => ({ ...t }));
    _atualizarTasksUI();
  }

  function _atualizarTasksUI() {
    const el = document.getElementById("tasks-lista");
    if (!el) return;
    if (_tasksAtuais.length === 0) {
      el.innerHTML = `<div class="empty"><p>Nenhuma tarefa. Crie a primeira!</p></div>`;
      return;
    }
    const hoje = new Date().toISOString().slice(0, 10);
    el.innerHTML = _tasksAtuais.map((t, i) => {
      const vencida = t.prazo && t.prazo < hoje && !t.feito;
      return `
        <div class="task-item ${t.feito ? "task-feita" : ""}">
          <input type="checkbox" class="task-check" ${t.feito ? "checked" : ""} onchange="CRM._toggleTask(${i},this.checked)">
          <div style="flex:1">
            <div class="task-texto">${t.texto}</div>
            ${t.prazo ? `<div class="task-prazo ${vencida ? "task-prazo-vencido" : ""}">${ic('calendar',10)} ${_fmtData(t.prazo)}</div>` : ""}
          </div>
          <button class="btn-sm" style="background:none;border:none;color:var(--muted);padding:2px 6px" onclick="CRM._removerTask(${i})" title="Remover">×</button>
        </div>`;
    }).join("");
  }

  function _toggleTask(idx, feito) {
    _tasksAtuais[idx].feito = feito;
    _atualizarTasksUI();
    if (editandoId) _salvarTasksImediato();
  }

  function _removerTask(idx) {
    _tasksAtuais.splice(idx, 1);
    _atualizarTasksUI();
  }

  function _adicionarTask() {
    const inp   = document.getElementById("task-input");
    const prazo = document.getElementById("task-prazo");
    if (!inp) return;
    const texto = inp.value.trim();
    if (!texto) return;
    _tasksAtuais.push({ id: Date.now(), texto, feito: false, prazo: prazo?.value || "" });
    inp.value = "";
    if (prazo) prazo.value = "";
    _atualizarTasksUI();
  }

  async function _salvarTasksImediato() {
    if (!editandoId) return;
    try {
      await Api.put(`/leads/${editandoId}`, { tasks: _tasksAtuais });
      const idx = leads.findIndex(l => l.id === editandoId);
      if (idx >= 0) leads[idx].tasks = [..._tasksAtuais];
    } catch (e) { /* silencioso */ }
  }

  // ── IA ─────────────────────────────────────────────────────────────────────
  async function analisarIA() {
    if (!editandoId) return;
    const l   = getLead(editandoId);
    if (!l) return;

    const btn = document.getElementById("btn-analisar-ia");
    if (btn) { btn.disabled = true; btn.textContent = "Analisando..."; }

    const elRes = document.getElementById("ia-resultado");
    if (elRes) elRes.innerHTML = `<div style="color:var(--muted);font-size:13px">Consultando IA...</div>`;

    try {
      const res = await Api.post("/ia/analisar", { lead: l });
      if (res.erro) throw new Error(res.erro);

      if (elRes) {
        elRes.innerHTML = `
          <div class="ia-panel">
            <div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">
              <div style="font-size:28px;font-weight:800;color:${res.score>=70?'var(--success)':res.score>=40?'var(--warn)':'#60a5fa'}">${res.score}</div>
              <div>
                <div style="font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:.5px">Score IA</div>
                <div style="font-size:12.5px">${res.justificativa || ""}</div>
              </div>
            </div>
            <div style="margin-bottom:8px">
              <div style="font-size:11px;color:var(--cyan);text-transform:uppercase;font-weight:700;margin-bottom:4px">Próxima Ação</div>
              <div class="ia-sugestao">${res.proxima_acao || "—"}</div>
            </div>
            ${res.insight ? `
            <div style="margin-top:8px;padding-top:8px;border-top:1px solid var(--border)">
              <div style="font-size:11px;color:var(--muted);text-transform:uppercase;font-weight:700;margin-bottom:4px">Insight</div>
              <div class="ia-sugestao">${res.insight}</div>
            </div>` : ""}
          </div>`;
      }
    } catch (e) {
      if (elRes) elRes.innerHTML = `<div style="color:var(--danger);font-size:13px">${ic('alert',14)} ${e.message}</div>`;
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Analisar com IA"; }
    }
  }

  function _limparPainelIA() {
    const el = document.getElementById("ia-resultado");
    if (el) el.innerHTML = "";
  }

  // ── Histórico ──────────────────────────────────────────────────────────────
  function renderHistorico(historico) {
    const el = document.getElementById("historico-lista");
    if (!el) return;
    if (!historico || historico.length === 0) {
      el.innerHTML = `<div class="empty"><p>Nenhum histórico registrado.</p></div>`;
      return;
    }
    el.innerHTML = [...historico].reverse().map(h => `
      <div class="historico-item">
        <div class="historico-data">${ic('history',12)} ${h.data}</div>
        <div class="historico-acao">${h.acao}</div>
      </div>`).join("");
  }

  // ── Salvar ─────────────────────────────────────────────────────────────────
  async function salvar() {
    const empresa = document.getElementById("f-empresa").value.trim();
    if (!empresa) { toast("Nome da empresa é obrigatório.", "error"); return; }

    const dados = {
      empresa,
      responsavel:    document.getElementById("f-responsavel").value.trim(),
      nicho:          document.getElementById("f-nicho").value.trim(),
      cidade:         document.getElementById("f-cidade").value.trim(),
      endereco:       document.getElementById("f-endereco").value.trim(),
      telefone:       document.getElementById("f-telefone").value.trim(),
      instagram:      document.getElementById("f-instagram").value.trim(),
      site:           document.getElementById("f-site").value.trim(),
      email:          document.getElementById("f-email").value.trim(),
      valor:          parseFloat(document.getElementById("f-valor").value) || 0,
      origem:         document.getElementById("f-origem").value,
      status:         document.getElementById("f-status").value,
      followup:       document.getElementById("f-followup").value,
      rating_google:  parseFloat(document.getElementById("f-rating").value) || 0,
      reviews_google: parseInt(document.getElementById("f-reviews").value) || 0,
      obs:            document.getElementById("f-obs").value.trim(),
      tags:           _tagsAtuais,
      tasks:          _tasksAtuais,
    };

    try {
      if (editandoId) {
        await Api.put(`/leads/${editandoId}`, dados);
        toast("Lead atualizado!", "success");
      } else {
        await Api.post("/leads", dados);
        toast("Lead criado!", "success");
      }
      fecharModal();
      await carregar();
    } catch (e) {
      toast("Erro ao salvar: " + e.message, "error");
    }
  }

  // ── Excluir ────────────────────────────────────────────────────────────────
  async function excluir(id) {
    const l = getLead(id);
    if (!confirm(`Excluir "${l?.empresa}"?`)) return;
    try {
      await Api.del(`/leads/${id}`);
      toast("Lead excluído.", "info");
      await carregar();
    } catch (e) {
      toast("Erro ao excluir: " + e.message, "error");
    }
  }

  // ── WhatsApp direto ────────────────────────────────────────────────────────
  function whatsapp(numero) {
    window.open(`https://wa.me/55${numero.replace(/\D/g, "")}`, "_blank");
  }

  // ── Histórico manual ───────────────────────────────────────────────────────
  async function adicionarHistorico() {
    if (!editandoId) return;
    const inp   = document.getElementById("nova-obs-hist");
    const texto = inp.value.trim();
    if (!texto) return;
    try {
      const updated = await Api.put(`/leads/${editandoId}`, { historico_add: texto });
      inp.value = "";
      renderHistorico(updated.historico || []);
      const idx = leads.findIndex(l => l.id === editandoId);
      if (idx >= 0) leads[idx] = updated;
      toast("Anotação adicionada.", "success");
    } catch (e) {
      toast("Erro: " + e.message, "error");
    }
  }

  // ── Export CSV ─────────────────────────────────────────────────────────────
  function exportarCSV() {
    const cols   = ["empresa","responsavel","nicho","cidade","telefone","instagram","site","email","valor","status","origem","followup","score","tags"];
    const header = cols.join(";");
    const rows   = leads.map(l => cols.map(c => {
      const v = c === "tags" ? (l.tags||[]).join("|") : (l[c] ?? "");
      return `"${v.toString().replace(/"/g,'""')}"`;
    }).join(";"));
    const blob = new Blob(["﻿" + [header, ...rows].join("\n")], { type:"text/csv;charset=utf-8;" });
    const a    = document.createElement("a");
    a.href     = URL.createObjectURL(blob);
    a.download = `base7-leads-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    toast("CSV exportado!", "success");
  }

  // ── Ordenação ──────────────────────────────────────────────────────────────
  function configurarOrdenacao() {
    document.querySelectorAll("th[data-col]").forEach(th => {
      th.addEventListener("click", () => {
        const col = th.dataset.col;
        if (ordenacao.col === col) ordenacao.asc = !ordenacao.asc;
        else { ordenacao.col = col; ordenacao.asc = true; }
        renderTabela();
      });
    });
  }

  // ── Filtros ────────────────────────────────────────────────────────────────
  function configurarFiltros() {
    ["busca","filtro-status","filtro-origem","filtro-tag"].forEach(id => {
      document.getElementById(id)?.addEventListener("input",  renderTabela);
      document.getElementById(id)?.addEventListener("change", renderTabela);
    });
  }

  // ── Helpers ────────────────────────────────────────────────────────────────
  function _set(id, v) { const e = document.getElementById(id); if (e) e.textContent = v; }
  function _val(id, v) { const e = document.getElementById(id); if (e) e.value = v; }

  return {
    carregar, getLead, getLeads, renderTabela, renderDashboard,
    abrirModalNovo, abrirModalEditar, fecharModal, fecharModalWA,
    abrirTemplatesWA, _enviarTemplate, _enviarViaAutomacao,
    salvar, excluir, whatsapp, adicionarHistorico,
    exportarCSV,
    configurarFiltros, configurarOrdenacao, scoreBadge,
    _removerTag, _adicionarTag, _tagInputKeydown, _addTagRapida,
    _adicionarTask, _toggleTask, _removerTask, _renderTagsRapidas,
    analisarIA, salvarTemplates, carregarTemplates,
    WA_TEMPLATES_DEFAULT, _getTemplates,
  };
})();
