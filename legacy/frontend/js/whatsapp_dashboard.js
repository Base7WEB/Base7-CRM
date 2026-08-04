const WhatsappDashboard = (() => {
  async function render() {
    const cont = document.getElementById("wa-dashboard-conteudo");
    if (!cont) return;
    cont.innerHTML = `<p style="color:var(--muted)">Carregando...</p>`;

    try {
      const [dash, template, nicho] = await Promise.all([
        Api.get("/whatsapp/dashboard"),
        Api.get("/analytics/por-template"),
        Api.get("/analytics/por-nicho"),
      ]);
      cont.innerHTML = _renderStats(dash) + _renderCampanhaAtiva(dash.campanha_ativa)
        + _renderLeadsQuentes(dash.leads_quentes) + _renderTemplateTable(template) + _renderNichoTable(nicho);
    } catch (e) {
      cont.innerHTML = `<p style="color:var(--danger)">Erro ao carregar dashboard: ${e.message}</p>`;
    }
  }

  function _card(icone, cor, valor, label) {
    return `
      <div class="stat-card">
        <div class="stat-icon si-${cor}"><span class="ic" data-icon-name="${icone}" data-icon-size="20"></span></div>
        <div class="stat-body"><div class="stat-num">${valor}</div><div class="stat-label">${label}</div></div>
      </div>`;
  }

  function _renderStats(dash) {
    return `
      <div class="stats-grid" style="margin-bottom:20px">
        ${_card("whatsapp", "blue", dash.mensagens_hoje, "Mensagens Hoje")}
        ${_card("leads", "cyan", dash.leads_contatados, "Leads Contatados")}
        ${_card("history", "green", dash.respostas, "Respostas")}
        ${_card("fire", "rose", dash.interessados, "Interessados")}
        ${_card("percent", "purple", dash.taxa_resposta + "%", "Taxa de Resposta")}
      </div>`;
  }

  function _renderCampanhaAtiva(campanha) {
    if (!campanha) return "";
    return `
      <div class="box" style="margin-bottom:20px">
        <h3 style="font-size:14px;margin-bottom:10px">Campanha ativa: ${campanha.nome}</h3>
        <div class="progress-bar-wrap"><div class="progress-bar" style="width:${campanha.progresso_pct}%"></div></div>
        <p class="progress-txt" style="margin-top:6px">${campanha.enviadas} / ${campanha.total} enviada(s) (${campanha.progresso_pct}%)</p>
      </div>`;
  }

  function _renderLeadsQuentes(leads) {
    if (!leads.length) return "";
    return `
      <div class="box" style="margin-bottom:20px">
        <h3 style="font-size:14px;margin-bottom:10px">${ic("fire", 15)} Leads Quentes</h3>
        ${leads.map(l => `
          <div style="padding:8px 0;border-bottom:1px solid var(--border);cursor:pointer;font-size:13px"
               onclick="Whatsapp._showTab('conversas', document.getElementById('wa-tab-conversas')); setTimeout(() => Conversas.abrir('${l.id}'), 200)">
            ${l.empresa}
          </div>`).join("")}
      </div>`;
  }

  function _renderTemplateTable(rows) {
    if (!rows.length) return "";
    return `
      <div class="box" style="margin-bottom:20px">
        <h3 style="font-size:14px;margin-bottom:10px">Desempenho por Template</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Template</th><th>Enviadas</th><th>Respostas</th><th>Interessados</th><th>Reuniões</th><th>Clientes</th><th>Taxa Resp.</th></tr></thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td>${r.template}</td><td>${r.enviadas}</td><td>${r.respostas}</td>
                  <td>${r.interessados}</td><td>${r.reunioes}</td><td>${r.clientes}</td>
                  <td>${r.taxa_resposta}%</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  function _renderNichoTable(rows) {
    if (!rows.length) return "";
    return `
      <div class="box">
        <h3 style="font-size:14px;margin-bottom:10px">Desempenho por Nicho</h3>
        <div class="table-wrap">
          <table>
            <thead><tr><th>Nicho</th><th>Contatados</th><th>Respostas</th><th>Taxa Resp.</th><th>Taxa Interesse</th></tr></thead>
            <tbody>
              ${rows.map(r => `
                <tr>
                  <td>${r.nicho}</td><td>${r.contatados}</td><td>${r.respostas}</td>
                  <td>${r.taxa_resposta}%</td><td>${r.taxa_interesse}%</td>
                </tr>`).join("")}
            </tbody>
          </table>
        </div>
      </div>`;
  }

  return { render };
})();
