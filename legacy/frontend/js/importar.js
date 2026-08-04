const ImportarArquivo = (() => {
  let colunas    = [];
  let linhas     = [];
  let mapeamento = {};

  const CAMPOS = [
    { chave: "empresa",     label: "Empresa" },
    { chave: "responsavel", label: "Responsável" },
    { chave: "telefone",    label: "Telefone" },
    { chave: "cidade",      label: "Cidade" },
    { chave: "nicho",       label: "Nicho" },
  ];

  function abrir() {
    reiniciar();
    document.getElementById("modal-importar-arquivo").classList.add("aberto");
  }

  function fechar() {
    document.getElementById("modal-importar-arquivo")?.classList.remove("aberto");
  }

  function reiniciar() {
    colunas = [];
    linhas  = [];
    mapeamento = {};
    const inp = document.getElementById("imp-input-arquivo");
    if (inp) inp.value = "";
    document.getElementById("imp-passo-arquivo").style.display     = "";
    document.getElementById("imp-passo-mapeamento").style.display  = "none";
  }

  async function selecionarArquivo(input) {
    const file = input.files[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("arquivo", file);

    try {
      const r = await fetch(`${API_BASE}/importar/preview`, { method: "POST", body: formData });
      const dados = await r.json();
      if (!r.ok) throw new Error(dados.erro || "Falha ao ler o arquivo");

      colunas    = dados.colunas || [];
      linhas     = dados.linhas || [];
      mapeamento = dados.mapeamento_sugerido || {};

      if (!linhas.length) { toast("Nenhuma linha encontrada no arquivo.", "error"); return; }

      _renderMapeamento();
      _renderPreview();
      document.getElementById("imp-passo-arquivo").style.display    = "none";
      document.getElementById("imp-passo-mapeamento").style.display = "";
    } catch (e) {
      toast("Erro ao ler arquivo: " + e.message, "error");
    }
  }

  function _renderMapeamento() {
    const cont = document.getElementById("imp-mapeamento-campos");
    cont.innerHTML = CAMPOS.map(c => `
      <div>
        <label>${c.label}</label>
        <select onchange="ImportarArquivo._atualizarMapeamento('${c.chave}', this.value)">
          <option value="">— não importar —</option>
          ${colunas.map((col, i) => `<option value="${i}" ${mapeamento[c.chave] === i ? "selected" : ""}>${col || ("Coluna " + (i + 1))}</option>`).join("")}
        </select>
      </div>`).join("");
  }

  function _atualizarMapeamento(campo, valor) {
    if (valor === "") delete mapeamento[campo];
    else mapeamento[campo] = parseInt(valor);
    _renderPreview();
  }

  function _renderPreview() {
    const thead = document.getElementById("imp-preview-thead");
    const tbody = document.getElementById("imp-preview-tbody");
    thead.innerHTML = `<tr>${CAMPOS.map(c => `<th>${c.label}</th>`).join("")}</tr>`;

    tbody.innerHTML = linhas.slice(0, 10).map(linha => `
      <tr>${CAMPOS.map(c => {
        const idx   = mapeamento[c.chave];
        const valor = (idx !== undefined && linha[idx] !== undefined) ? linha[idx] : "";
        return `<td>${valor || "—"}</td>`;
      }).join("")}</tr>`).join("");

    document.getElementById("imp-total-linhas").textContent =
      `(${linhas.length} linha(s) no arquivo, mostrando até 10)`;
  }

  function _montarLeads() {
    return linhas.map(linha => {
      const lead = {};
      CAMPOS.forEach(c => {
        const idx = mapeamento[c.chave];
        if (idx !== undefined && linha[idx] !== undefined) lead[c.chave] = String(linha[idx]).trim();
      });
      return lead;
    }).filter(l => l.empresa || l.telefone);
  }

  async function confirmar() {
    const leads_novos = _montarLeads();
    if (!leads_novos.length) { toast("Nenhum lead válido com o mapeamento atual.", "error"); return; }
    if (!confirm(`Importar ${leads_novos.length} lead(s)?`)) return;

    try {
      const resp = await Api.post("/importar", {
        leads: leads_novos.map(l => ({ ...l, origem: l.origem || "Importação" })),
      });
      toast(`${resp.importados} importado(s) · ${resp.duplicados?.length || 0} duplicado(s)`, "success");
      fechar();
      await CRM.carregar();
    } catch (e) {
      toast("Erro ao importar: " + e.message, "error");
    }
  }

  return { abrir, fechar, reiniciar, selecionarArquivo, _atualizarMapeamento, confirmar };
})();
