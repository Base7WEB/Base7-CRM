const Conversas = (() => {
  let conversaAtualLeadId = null;
  let pollTimer = null;

  async function render() {
    const cont = document.getElementById("wa-conversas-conteudo");
    if (!cont) return;

    if (!cont.dataset.montado) {
      cont.innerHTML = `
        <div style="display:flex;height:520px;border:1px solid var(--border);border-radius:10px;overflow:hidden">
          <div id="conversas-lista" style="width:280px;border-right:1px solid var(--border);overflow-y:auto;flex-shrink:0"></div>
          <div id="conversas-detalhe" style="flex:1;display:flex;flex-direction:column;min-width:0">
            <div style="flex:1;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:13px">
              Selecione uma conversa
            </div>
          </div>
        </div>`;
      cont.dataset.montado = "1";
    }

    await _carregarLista();
    _gerenciarPolling();
  }

  function _gerenciarPolling() {
    if (pollTimer) { clearTimeout(pollTimer); pollTimer = null; }
    pollTimer = setTimeout(() => {
      const visivel = document.getElementById("wa-panel-conversas")?.style.display !== "none";
      if (visivel) render();
    }, 8000);
  }

  async function _carregarLista() {
    const listaEl = document.getElementById("conversas-lista");
    if (!listaEl) return;
    try {
      const conversas = await Api.get("/conversations");
      if (!conversas.length) {
        listaEl.innerHTML = `<p style="padding:16px;color:var(--muted);font-size:12.5px">Nenhuma conversa ainda.</p>`;
        return;
      }
      listaEl.innerHTML = conversas.map(c => {
        const ativo = c.lead_id === conversaAtualLeadId;
        const preview = c.ultima_mensagem
          ? (c.ultima_mensagem.direcao === "enviada" ? "Você: " : "") + c.ultima_mensagem.texto
          : "Sem mensagens";
        return `
          <div style="padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;${ativo ? "background:var(--bg3)" : ""}"
               onclick="Conversas.abrir('${c.lead_id}')">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:6px">
              <strong style="font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${c.empresa}</strong>
              ${c.temperatura === "quente" ? ic("fire", 13) : ""}
            </div>
            <p style="font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px">
              ${preview}
            </p>
          </div>`;
      }).join("");
    } catch (e) {
      listaEl.innerHTML = `<p style="padding:16px;color:var(--danger);font-size:12.5px">Erro: ${e.message}</p>`;
    }
  }

  async function abrir(leadId) {
    conversaAtualLeadId = leadId;
    _marcarItemAtivo();

    const detalheEl = document.getElementById("conversas-detalhe");
    detalheEl.innerHTML = `<p style="padding:16px;color:var(--muted)">Carregando...</p>`;

    try {
      const { lead, conversa } = await Api.get(`/conversations/${leadId}`);
      detalheEl.innerHTML = `
        <div style="padding:12px 16px;border-bottom:1px solid var(--border)">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:10px">
            <div>
              <strong>${lead.empresa}</strong>
              <p style="font-size:11.5px;color:var(--muted)">
                ${lead.nicho || "—"}${lead.cidade ? " · " + lead.cidade : ""} · Score ${lead.score || 0}
              </p>
            </div>
            <button class="btn-sm btn-outline" onclick="Conversas.analisar('${leadId}')" style="flex-shrink:0">
              <span class="ic" data-icon-name="star" data-icon-size="13"></span> Analisar com IA
            </button>
          </div>
          <div id="conversas-analise-ia"></div>
        </div>
        <div id="conversas-mensagens" style="flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:8px"></div>
        <div style="padding:12px;border-top:1px solid var(--border)">
          <button class="btn-sm btn-outline" style="margin-bottom:8px" onclick="Conversas.gerarResposta('${leadId}')">
            <span class="ic" data-icon-name="star" data-icon-size="12"></span> Gerar resposta com IA
          </button>
          <div style="display:flex;gap:8px">
            <input id="conversas-input-msg" placeholder="Escrever mensagem..." style="flex:1;margin:0"
                   onkeydown="if(event.key==='Enter')Conversas.enviar('${leadId}')">
            <button class="btn" onclick="Conversas.enviar('${leadId}')">
              <span class="ic" data-icon-name="whatsapp" data-icon-size="14"></span>
            </button>
          </div>
        </div>`;
      _renderMensagens(conversa.mensagens || []);
      _renderAnalise(conversa.ultima_analise_ia);
    } catch (e) {
      detalheEl.innerHTML = `<p style="padding:16px;color:var(--danger)">Erro: ${e.message}</p>`;
    }
  }

  function _marcarItemAtivo() {
    // Re-render leve da lista para destacar a conversa selecionada sem esperar o polling.
    _carregarLista();
  }

  function _renderMensagens(mensagens) {
    const el = document.getElementById("conversas-mensagens");
    if (!el) return;
    el.innerHTML = mensagens.map(m => {
      const enviada = m.direcao === "enviada";
      return `
        <div style="align-self:${enviada ? "flex-end" : "flex-start"};max-width:75%">
          <div style="background:${enviada ? "var(--blue)" : "var(--bg3)"};color:${enviada ? "#fff" : "var(--text)"};
                      padding:8px 12px;border-radius:10px;font-size:13px;white-space:pre-wrap">${m.texto}</div>
        </div>`;
    }).join("") || `<p style="color:var(--muted);font-size:12.5px">Nenhuma mensagem ainda.</p>`;
    el.scrollTop = el.scrollHeight;
  }

  function _renderAnalise(analise) {
    const el = document.getElementById("conversas-analise-ia");
    if (!el) return;
    if (!analise) { el.innerHTML = ""; return; }

    const emoji = { quente: "🔥", morno: "🟡", frio: "🔵" }[analise.temperatura] || "";
    el.innerHTML = `
      <div class="box" style="margin-top:10px;padding:10px 12px">
        <p style="font-size:12.5px">
          <strong>${emoji} ${analise.temperatura || "—"}</strong> · ${analise.intencao || "—"}
          · confiança ${Math.round((analise.confianca || 0) * 100)}%
        </p>
        <p style="font-size:12px;color:var(--muted);margin-top:4px">
          Próxima ação sugerida: ${analise.proxima_acao || "—"}
        </p>
        ${analise.status_sugerido ? `
        <p style="font-size:12px;color:var(--cyan);margin-top:4px">
          Sugestão: mover para "${analise.status_sugerido}" no pipeline
        </p>` : ""}
      </div>`;
  }

  async function analisar(leadId) {
    const el = document.getElementById("conversas-analise-ia");
    if (el) el.innerHTML = `<p style="font-size:12px;color:var(--muted);margin-top:8px">Analisando com IA...</p>`;
    try {
      const analise = await Api.post(`/conversations/${leadId}/analyze`, {});
      _renderAnalise(analise);
      toast("Análise concluída!", "success");
    } catch (e) {
      let msg = e.message;
      try { msg = JSON.parse(e.message).erro || msg; } catch { /* mensagem já é texto simples */ }
      toast("Erro na análise: " + msg, "error");
      if (el) el.innerHTML = "";
    }
  }

  async function gerarResposta(leadId) {
    toast("Gerando resposta com IA...", "info");
    try {
      const { resposta } = await Api.post(`/conversations/${leadId}/generate-response`, {});
      const inp = document.getElementById("conversas-input-msg");
      if (inp) { inp.value = resposta; inp.focus(); }
    } catch (e) {
      let msg = e.message;
      try { msg = JSON.parse(e.message).erro || msg; } catch { /* mensagem já é texto simples */ }
      toast("Erro ao gerar resposta: " + msg, "error");
    }
  }

  async function enviar(leadId) {
    const inp = document.getElementById("conversas-input-msg");
    const texto = inp.value.trim();
    if (!texto) return;
    inp.value = "";

    try {
      await Api.post(`/conversations/${leadId}/send`, { texto });
      await abrir(leadId);
    } catch (e) {
      let msg = e.message;
      try { msg = JSON.parse(e.message).erro || msg; } catch { /* mensagem já é texto simples */ }
      toast("Erro ao enviar: " + msg, "error");
    }
  }

  return { render, abrir, enviar, analisar, gerarResposta };
})();
