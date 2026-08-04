// ── Toast ────────────────────────────────────────────────────────────────────
function toast(msg, tipo = "info") {
  const icMap = { success: "check", error: "alert", info: "history" };
  const el = document.createElement("div");
  el.className = `toast toast-${tipo}`;
  el.innerHTML = `${ic(icMap[tipo] || "history", 16)} <span>${msg}</span>`;
  document.getElementById("toast-container").appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ── Tabs ─────────────────────────────────────────────────────────────────────
const App = {
  trocarTab(btn, panelId) {
    btn.closest(".tabs").querySelectorAll(".tab-btn").forEach(b => b.classList.remove("ativo"));
    btn.classList.add("ativo");
    btn.closest(".modal-content").querySelectorAll(".tab-panel").forEach(p => p.classList.remove("ativo"));
    document.getElementById(panelId).classList.add("ativo");
  },

  // ── Navegação ──────────────────────────────────────────────────────────────
  navegarPara(viewId) {
    document.querySelectorAll(".view").forEach(v => v.classList.remove("ativa"));
    document.getElementById(`view-${viewId}`)?.classList.add("ativa");

    document.querySelectorAll(".menu-btn").forEach(b => b.classList.remove("ativo"));
    document.querySelector(`.menu-btn[data-view="${viewId}"]`)?.classList.add("ativo");

    if (viewId === "relatorios") Relatorios.render(CRM.getLeads());
    if (viewId === "config") {
      Config.carregarIA();
      Config.carregarMeta();
      Config.carregarAgendamento();
      Config.renderTemplatesEditor();
      Config.carregarConhecimento();
      Config.carregarAutomacaoIA();
    }
    if (viewId === "whatsapp") Whatsapp.entrarNaView();
  },

  // ── Backend ────────────────────────────────────────────────────────────────
  async verificarBackend() {
    const dots = [document.getElementById("statusDot"), document.getElementById("statusDot2")];
    const txts = [document.getElementById("statusTxt"), document.getElementById("statusTxt2")];
    try {
      await Api.get("/status");
      dots.forEach(d => { if (d) d.classList.add("online"); });
      txts.forEach(t => { if (t) t.textContent = "Backend online"; });
    } catch {
      dots.forEach(d => { if (d) d.classList.remove("online"); });
      txts.forEach(t => { if (t) t.textContent = "Backend offline"; });
    }
  },

  // ── Init ──────────────────────────────────────────────────────────────────
  async init() {
    document.querySelectorAll(".menu-btn[data-view]").forEach(btn => {
      btn.addEventListener("click", () => App.navegarPara(btn.dataset.view));
    });

    document.getElementById("modal-lead").addEventListener("click", e => {
      if (e.target === e.currentTarget) CRM.fecharModal();
    });
    document.getElementById("modal-wa-templates")?.addEventListener("click", e => {
      if (e.target === e.currentTarget) CRM.fecharModalWA();
    });
    document.getElementById("modal-relatorio-semanal")?.addEventListener("click", e => {
      if (e.target === e.currentTarget) Relatorios.fecharModalRelatorio();
    });
    document.getElementById("modal-campanha")?.addEventListener("click", e => {
      if (e.target === e.currentTarget) Campanhas.fecharWizard();
    });
    document.getElementById("modal-importar-arquivo")?.addEventListener("click", e => {
      if (e.target === e.currentTarget) ImportarArquivo.fechar();
    });

    CRM.configurarFiltros();
    CRM.configurarOrdenacao();
    CRM._renderTagsRapidas();

    await App.verificarBackend();
    await CRM.carregar();

    setInterval(App.verificarBackend, 30000);
  }
};

// ── Config ───────────────────────────────────────────────────────────────────
const Config = {
  salvar() {
    localStorage.setItem("base7-cfg", JSON.stringify({
      delay:  document.getElementById("cfg-delay").value,
      max:    document.getElementById("cfg-max").value,
      rating: document.getElementById("cfg-rating").value,
    }));
    toast("Configurações salvas.", "success");
  },

  carregar() {
    const cfg = JSON.parse(localStorage.getItem("base7-cfg") || "{}");
    if (cfg.delay)  document.getElementById("cfg-delay").value  = cfg.delay;
    if (cfg.max)    document.getElementById("cfg-max").value    = cfg.max;
    if (cfg.rating) document.getElementById("cfg-rating").value = cfg.rating;
  },

  // ── Meta Mensal ──────────────────────────────────────────────────────────
  async salvarMeta() {
    const val = parseFloat(document.getElementById("cfg-meta-valor")?.value) || 0;
    const mes = new Date().toISOString().slice(0, 7);
    try {
      await Api.post("/meta", { valor: val, mes });
      toast("Meta mensal salva!", "success");
      await CRM.renderDashboard();
    } catch (e) {
      toast("Erro ao salvar meta: " + e.message, "error");
    }
  },

  async carregarMeta() {
    try {
      const meta = await Api.get("/meta");
      const el   = document.getElementById("cfg-meta-valor");
      if (el) el.value = meta.valor || "";
    } catch (e) { /* silencioso */ }
  },

  // ── IA / Claude API ───────────────────────────────────────────────────────
  async carregarIA() {
    try {
      const cfg = await Api.get("/config");
      const el  = document.getElementById("ia-key-hint");
      if (el) {
        if (cfg.claude_api_key_set) {
          el.textContent = `Chave configurada: ${cfg.claude_api_key_hint}`;
          el.style.color = "var(--success)";
        } else {
          el.textContent = "Nenhuma chave configurada";
          el.style.color = "var(--muted)";
        }
      }
      const libEl = document.getElementById("ia-lib-status");
      if (libEl) {
        libEl.textContent = cfg.claude_disponivel ? "✓ Biblioteca anthropic instalada" : "✗ Execute: pip install anthropic";
        libEl.style.color = cfg.claude_disponivel ? "var(--success)" : "var(--warn)";
      }
    } catch (e) { /* silencioso */ }
  },

  async salvarChaveIA() {
    const inp = document.getElementById("cfg-ia-key");
    const key = inp?.value.trim();
    if (!key) { toast("Informe a chave API.", "error"); return; }
    try {
      await Api.post("/config", { claude_api_key: key });
      if (inp) inp.value = "";
      toast("Chave salva com sucesso!", "success");
      await Config.carregarIA();
    } catch (e) {
      toast("Erro: " + e.message, "error");
    }
  },

  // ── Agendamento ──────────────────────────────────────────────────────────
  async salvarAgendamento() {
    const ativo    = document.getElementById("agd-ativo")?.checked || false;
    const nicho    = document.getElementById("agd-nicho")?.value.trim() || "";
    const cidades  = document.getElementById("agd-cidades")?.value.trim() || "";
    const max      = parseInt(document.getElementById("agd-max")?.value) || 30;
    const dia      = parseInt(document.getElementById("agd-dia")?.value) || 1;
    try {
      await Api.post("/config", {
        agendado_ativo: ativo,
        agendado_nicho: nicho,
        agendado_cidades: cidades,
        agendado_max: max,
        agendado_dia_semana: dia,
      });
      toast(`Agendamento ${ativo ? "ativado" : "desativado"}!`, "success");
    } catch (e) {
      toast("Erro: " + e.message, "error");
    }
  },

  async carregarAgendamento() {
    try {
      const cfg = await Api.get("/config");
      const set = (id, v) => { const e = document.getElementById(id); if (e) e.value = v; };
      const chk = (id, v) => { const e = document.getElementById(id); if (e) e.checked = !!v; };
      chk("agd-ativo",   cfg.agendado_ativo);
      set("agd-nicho",   cfg.agendado_nicho   || "");
      set("agd-cidades", cfg.agendado_cidades  || "");
      set("agd-max",     cfg.agendado_max      || 30);
      set("agd-dia",     cfg.agendado_dia_semana ?? 1);
    } catch (e) { /* silencioso */ }
  },

  // ── Templates WhatsApp ─────────────────────────────────────────────────────
  renderTemplatesEditor() {
    const el       = document.getElementById("templates-editor");
    if (!el) return;
    const templates = CRM._getTemplates();
    const ETAPAS    = ["Novo","Contato","Reunião","Proposta","Negociação","Cliente","Perdido"];

    el.innerHTML = ETAPAS.map(etapa => {
      const lista = templates[etapa] || [];
      return `
        <div class="templates-etapa">
          <h4 style="font-size:13px;color:var(--cyan);margin-bottom:8px;text-transform:uppercase;letter-spacing:.5px">${etapa}</h4>
          ${lista.map((t, i) => `
            <div class="template-row" style="margin-bottom:10px">
              <input value="${t.nome}" placeholder="Nome do template"
                onchange="Config._updateTemplateName('${etapa}',${i},this.value)"
                style="width:100%;margin-bottom:5px;font-size:12px;padding:7px 10px">
              <textarea rows="2" style="font-size:12px;padding:7px 10px"
                onchange="Config._updateTemplateTexto('${etapa}',${i},this.value)">${t.texto}</textarea>
            </div>`).join("")}
          <button class="btn-sm btn-ghost" style="font-size:12px" onclick="Config._addTemplate('${etapa}')">+ Adicionar template</button>
        </div>`;
    }).join(`<hr style="border:none;border-top:1px solid var(--border);margin:16px 0">`);
  },

  _tplEditando: null,

  _getEditando() {
    if (!this._tplEditando) this._tplEditando = JSON.parse(JSON.stringify(CRM._getTemplates()));
    return this._tplEditando;
  },

  _updateTemplateName(etapa, idx, val) {
    const t = this._getEditando();
    if (t[etapa]?.[idx]) t[etapa][idx].nome = val;
  },

  _updateTemplateTexto(etapa, idx, val) {
    const t = this._getEditando();
    if (t[etapa]?.[idx]) t[etapa][idx].texto = val;
  },

  _addTemplate(etapa) {
    const t = this._getEditando();
    if (!t[etapa]) t[etapa] = [];
    t[etapa].push({ nome: "Novo template", texto: "Olá {empresa}!" });
    this.renderTemplatesEditor();
  },

  async salvarTemplates() {
    if (!this._tplEditando) { toast("Nenhuma alteração.", "info"); return; }
    await CRM.salvarTemplates(this._tplEditando);
    this._tplEditando = null;
  },

  // ── Automação de IA ──────────────────────────────────────────────────────────
  async carregarAutomacaoIA() {
    try {
      const cfg = await Api.get("/config");
      const nivel = cfg.ia_automacao_nivel || "analise";
      const radio = document.querySelector(`input[name="ia-automacao-nivel"][value="${nivel}"]`);
      if (radio) radio.checked = true;

      const chk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
      chk("ia-auto-perguntas_simples", cfg.ia_auto_perguntas_simples ?? true);
      chk("ia-auto-preco", cfg.ia_auto_preco);
      chk("ia-auto-reuniao", cfg.ia_auto_reuniao);
    } catch (e) { /* silencioso */ }
  },

  async salvarAutomacaoIA() {
    const nivel = document.querySelector('input[name="ia-automacao-nivel"]:checked')?.value || "analise";
    try {
      await Api.post("/config", {
        ia_automacao_nivel: nivel,
        ia_auto_perguntas_simples: document.getElementById("ia-auto-perguntas_simples")?.checked || false,
        ia_auto_preco: document.getElementById("ia-auto-preco")?.checked || false,
        ia_auto_reuniao: document.getElementById("ia-auto-reuniao")?.checked || false,
      });
      toast("Automação de IA salva!", "success");
    } catch (e) {
      toast("Erro ao salvar: " + e.message, "error");
    }
  },

  // ── Conhecimento comercial da Base7 ─────────────────────────────────────────
  _CAMPOS_KB: ["sobre", "produtos", "servicos", "precos", "diferenciais", "faq", "objecoes", "politicas"],

  async carregarConhecimento() {
    try {
      const kb = await Api.get("/knowledge-base");
      this._CAMPOS_KB.forEach(campo => {
        const el = document.getElementById(`kb-${campo}`);
        if (el) el.value = kb[campo] || "";
      });
    } catch (e) { /* silencioso */ }
  },

  async salvarConhecimento() {
    const dados = {};
    this._CAMPOS_KB.forEach(campo => {
      dados[campo] = document.getElementById(`kb-${campo}`)?.value.trim() || "";
    });
    try {
      await Api.post("/knowledge-base", dados);
      toast("Conhecimento comercial salvo!", "success");
    } catch (e) {
      toast("Erro ao salvar: " + e.message, "error");
    }
  },

  // ── Backup ────────────────────────────────────────────────────────────────
  async exportarBackup() {
    try {
      const leads = await Api.get("/backup");
      const blob  = new Blob([JSON.stringify(leads, null, 2)], { type: "application/json" });
      const a     = document.createElement("a");
      a.href      = URL.createObjectURL(blob);
      a.download  = `base7-backup-${new Date().toISOString().slice(0,10)}.json`;
      a.click();
      toast("Backup exportado!", "success");
    } catch (e) {
      toast("Erro ao exportar: " + e.message, "error");
    }
  },

  async importarBackup(input) {
    const file = input.files[0];
    if (!file) return;
    const texto = await file.text();
    let dados;
    try { dados = JSON.parse(texto); } catch { toast("JSON inválido.", "error"); return; }
    if (!Array.isArray(dados)) { toast("Formato inválido.", "error"); return; }
    if (!confirm(`Importar ${dados.length} leads? Os dados atuais serão substituídos.`)) return;
    try {
      await Api.post("/restore", dados);
      toast(`${dados.length} leads restaurados!`, "success");
      await CRM.carregar();
    } catch (e) {
      toast("Erro ao restaurar: " + e.message, "error");
    }
    input.value = "";
  },

  async limparTudo() {
    if (!confirm("TODOS os leads serão apagados permanentemente.")) return;
    if (!confirm("Confirme novamente: apagar tudo?")) return;
    try {
      await Api.post("/restore", []);
      toast("Todos os leads foram apagados.", "info");
      await CRM.carregar();
    } catch (e) {
      toast("Erro: " + e.message, "error");
    }
  }
};

// ── Ícones estáticos ──────────────────────────────────────────────────────────
function initIcons() {
  document.querySelectorAll("[data-icon-name]").forEach(el => {
    const name = el.getAttribute("data-icon-name");
    const size = parseInt(el.getAttribute("data-icon-size")) || 18;
    el.style.cssText += `width:${size}px;height:${size}px;display:inline-flex;align-items:center;flex-shrink:0`;
    const svg = ICON[name];
    if (svg) el.innerHTML = svg;
  });
}

// ── Inicializar ───────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", async () => {
  initIcons();
  Config.carregar();
  await CRM.carregarTemplates();
  await App.init();
  await Config.carregarMeta();
  await Config.carregarAgendamento();
  Whatsapp.init();
  Notificacoes.init();
});
