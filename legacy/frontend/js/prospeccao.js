const Prospeccao = (() => {
  let resultados   = [];
  let selecionados = new Set();
  let polling      = null;

  // ── Google Maps ────────────────────────────────────────────────────────────
  async function iniciar() {
    const nicho  = document.getElementById("p-nicho").value.trim();
    const cidade = document.getElementById("p-cidade").value.trim();
    const raio   = parseInt(document.getElementById("p-raio").value) || 10;
    const rating = parseFloat(document.getElementById("p-rating").value) || 0;
    const max    = parseInt(document.getElementById("p-max").value) || 40;
    const enriq  = document.getElementById("p-enriquecer")?.checked || false;

    if (!nicho || !cidade) {
      toast("Preencha o nicho e a cidade.", "error");
      return;
    }

    // Suporta múltiplas cidades separadas por vírgula
    const cidades = cidade.split(",").map(c => c.trim()).filter(Boolean);

    const btn = document.getElementById("btn-pesquisar");
    btn.disabled    = true;
    btn.textContent = "⏳ Pesquisando...";

    resultados = [];
    selecionados.clear();

    document.getElementById("box-resultados").style.display = "block";
    document.getElementById("progresso-area").style.display = "block";
    document.getElementById("resultados-acoes").style.display = "none";
    document.getElementById("tabela-resultados").innerHTML = "";
    document.getElementById("progresso-txt").textContent = cidades.length > 1
      ? `Iniciando scraper para ${cidades.length} cidades...`
      : "Iniciando scraper...";
    document.getElementById("progress-bar").style.width = "0%";

    try {
      await Api.post("/pesquisar", {
        nicho,
        cidades,
        raio_km:        raio,
        rating_min:     rating,
        max_resultados: max,
        enriquecer:     enriq,
      });
      polling = setInterval(_verificarStatus, 1500);
    } catch (e) {
      toast("Erro ao iniciar pesquisa: " + e.message, "error");
      _resetarBtn();
    }
  }

  async function _verificarStatus() {
    try {
      const st  = await Api.get("/pesquisar/status");
      const pct = st.total > 0 ? Math.round((st.progresso / st.total) * 100) : 0;

      document.getElementById("progress-bar").style.width = pct + "%";
      document.getElementById("progresso-txt").textContent =
        `Coletando... ${st.progresso} de ${st.total} resultados (${pct}%)`;

      if (!st.rodando) {
        clearInterval(polling);
        polling = null;

        if (st.erro) {
          toast("Erro no scraper: " + st.erro, "error");
          _resetarBtn();
          return;
        }

        resultados = st.resultados || [];
        _renderResultados();
        _resetarBtn();
        toast(`${resultados.length} resultados encontrados!`, "success");
      }
    } catch (e) {
      clearInterval(polling);
      polling = null;
      toast("Erro ao verificar status: " + e.message, "error");
      _resetarBtn();
    }
  }

  function _renderResultados() {
    document.getElementById("progresso-area").style.display = "none";
    document.getElementById("resultados-acoes").style.display = "flex";

    const tbody = document.getElementById("tabela-resultados");

    if (resultados.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9"><div class="empty"><div class="icon">🔍</div><p>Nenhum resultado encontrado. Tente outro nicho ou cidade.</p></div></td></tr>`;
      return;
    }

    tbody.innerHTML = resultados.map((r, i) => `
      <tr id="res-row-${i}">
        <td>
          <input type="checkbox" data-idx="${i}"
            onchange="Prospeccao._toggleSelect(${i}, this.checked)">
        </td>
        <td><strong>${r.empresa || "—"}</strong></td>
        <td style="font-size:12px;color:var(--muted)">${r.endereco || "—"}</td>
        <td>
          ${r.telefone
            ? `<button class="btn-sm btn-success" onclick="CRM.whatsapp('${r.telefone}')">📲 ${r.telefone}</button>`
            : `<span style="color:var(--muted);font-size:12px">—</span>`}
        </td>
        <td style="font-size:12px">
          ${r.email
            ? `<span style="color:var(--cyan)">${r.email}</span>`
            : `<span style="color:var(--muted)">—</span>`}
        </td>
        <td>
          ${r.site
            ? `<a href="${r.site}" target="_blank" style="color:var(--cyan);font-size:12px">🔗 Site</a>`
            : `<span style="color:var(--muted);font-size:12px">—</span>`}
        </td>
        <td style="font-size:12px">${r.nicho || "—"}</td>
        <td>
          ${r.rating_google > 0
            ? `<span style="color:var(--warn)">⭐ ${r.rating_google.toFixed(1)}</span>`
            : "—"}
        </td>
        <td style="font-size:12px;color:var(--muted)">${r.reviews_google > 0 ? r.reviews_google : "—"}</td>
      </tr>
    `).join("");

    _atualizarContador();
  }

  function _toggleSelect(idx, checked) {
    if (checked) selecionados.add(idx);
    else selecionados.delete(idx);
    _atualizarContador();
  }

  function selecionarTodos(checked) {
    selecionados.clear();
    document.querySelectorAll("#tabela-resultados input[type=checkbox]").forEach((cb, i) => {
      cb.checked = checked;
      if (checked) selecionados.add(i);
    });
    _atualizarContador();
  }

  function _atualizarContador() {
    const n   = selecionados.size;
    document.getElementById("sel-count").textContent = `${n} selecionado${n !== 1 ? "s" : ""}`;
    const btn = document.getElementById("btn-importar");
    btn.disabled = n === 0;
    const txt = document.getElementById("btn-importar-txt");
    if (txt) txt.textContent = `Importar Selecionados (${n})`;
  }

  async function importar() {
    const lista = [...selecionados].map(i => resultados[i]);
    if (lista.length === 0) return;

    try {
      const resp = await Api.post("/importar", { leads: lista });
      const msg  = `${resp.importados} lead(s) importado(s)` +
        (resp.duplicados?.length ? ` · ${resp.duplicados.length} duplicado(s) ignorado(s)` : "");
      toast(msg, resp.importados > 0 ? "success" : "info");

      if (resp.importados > 0) await CRM.carregar();

      selecionados.clear();
      document.querySelectorAll("#tabela-resultados input[type=checkbox]").forEach(cb => cb.checked = false);
      document.getElementById("sel-todos").checked = false;
      _atualizarContador();
    } catch (e) {
      toast("Erro ao importar: " + e.message, "error");
    }
  }

  // ── Instagram ──────────────────────────────────────────────────────────────
  async function iniciarInstagram() {
    const hashtag = document.getElementById("ig-hashtag")?.value.trim();
    const max     = parseInt(document.getElementById("ig-max")?.value) || 20;
    if (!hashtag) { toast("Informe a hashtag.", "error"); return; }

    const btn = document.getElementById("btn-ig-buscar");
    if (btn) { btn.disabled = true; btn.textContent = "⏳ Buscando..."; }

    document.getElementById("ig-resultados-area").style.display = "block";
    document.getElementById("ig-progresso-txt").textContent = "Iniciando busca no Instagram...";

    try {
      await Api.post("/pesquisar-instagram", { hashtag, max_resultados: max });
      const igPoll = setInterval(async () => {
        try {
          const st = await Api.get("/pesquisar/status");
          if (!st.rodando) {
            clearInterval(igPoll);
            if (btn) { btn.disabled = false; btn.textContent = "Buscar"; }
            const res = st.resultados || [];
            document.getElementById("ig-progresso-txt").textContent = `${res.length} perfis encontrados`;
            _renderResultadosIG(res);
          }
        } catch (e) {
          clearInterval(igPoll);
          if (btn) { btn.disabled = false; btn.textContent = "Buscar"; }
        }
      }, 2000);
    } catch (e) {
      toast("Erro: " + e.message, "error");
      if (btn) { btn.disabled = false; btn.textContent = "Buscar"; }
    }
  }

  function _renderResultadosIG(lista) {
    _igResultados = lista;
    const el = document.getElementById("ig-tabela");
    if (!el) return;
    if (lista.length === 0) {
      el.innerHTML = `<tr><td colspan="3"><div class="empty"><p>Nenhum perfil encontrado.</p></div></td></tr>`;
      return;
    }
    el.innerHTML = lista.map((r, i) => `
      <tr>
        <td><input type="checkbox" data-ig-idx="${i}" onchange="Prospeccao._toggleIG(${i},this.checked)"></td>
        <td><strong>${r.empresa || "—"}</strong></td>
        <td style="font-size:12px;color:var(--cyan)">${r.instagram || "—"}</td>
      </tr>`).join("");
  }

  let _igSelecionados = new Set();
  let _igResultados   = [];

  function _toggleIG(idx, checked) {
    if (checked) _igSelecionados.add(idx);
    else _igSelecionados.delete(idx);
  }

  async function importarIG() {
    const lista = [..._igSelecionados].map(i => ({ ..._igResultados[i], origem: "Instagram" }));
    if (lista.length === 0) { toast("Nenhum item selecionado.", "error"); return; }
    try {
      const resp = await Api.post("/importar", { leads: lista });
      toast(`${resp.importados} importado(s)`, "success");
      await CRM.carregar();
    } catch (e) {
      toast("Erro: " + e.message, "error");
    }
  }

  function _resetarBtn() {
    const btn = document.getElementById("btn-pesquisar");
    if (btn) { btn.disabled = false; btn.textContent = "Pesquisar"; }
  }

  return {
    iniciar, importar, selecionarTodos, _toggleSelect,
    iniciarInstagram, importarIG, _toggleIG,
  };
})();
