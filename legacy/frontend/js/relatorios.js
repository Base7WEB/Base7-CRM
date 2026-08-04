const Relatorios = (() => {
  let charts = {};
  const CORES = ["#2563eb","#00e5ff","#22c55e","#f59e0b","#ef4444","#a855f7","#ec4899"];

  function render(leads) {
    _chartStatus(leads);
    _chartMeses(leads);
    _chartValor(leads);
    _followupsSemana(leads);
  }

  function _destroy(id) {
    if (charts[id]) { charts[id].destroy(); delete charts[id]; }
  }

  const _chartOpts = {
    plugins: { legend: { labels: { color: "#94a3b8", font: { size: 12 } } } },
    scales: {
      x: { ticks: { color: "#64748b" }, grid: { color: "rgba(255,255,255,.04)" } },
      y: { ticks: { color: "#64748b" }, grid: { color: "rgba(255,255,255,.04)" } },
    }
  };

  function _chartStatus(leads) {
    _destroy("status");
    const STATUS = ["Novo","Contato","Reunião","Proposta","Negociação","Cliente","Perdido"];
    charts.status = new Chart(document.getElementById("chart-status"), {
      type: "doughnut",
      data: {
        labels: STATUS,
        datasets: [{ data: STATUS.map(s => leads.filter(l => l.status === s).length), backgroundColor: CORES, borderWidth: 0 }]
      },
      options: { plugins: { legend: { labels: { color: "#94a3b8", font: { size: 12 } } } } }
    });
  }

  function _chartMeses(leads) {
    _destroy("meses");
    const contagem = {};
    leads.forEach(l => { const mes = (l.criadoEm || "").slice(0, 7); if (mes) contagem[mes] = (contagem[mes] || 0) + 1; });
    const labels = Object.keys(contagem).sort().slice(-12);
    charts.meses = new Chart(document.getElementById("chart-meses"), {
      type: "bar",
      data: {
        labels: labels.map(m => { const [y,mo] = m.split("-"); return `${mo}/${y}`; }),
        datasets: [{ label: "Leads", data: labels.map(m => contagem[m]), backgroundColor: "#2563eb", borderRadius: 6 }]
      },
      options: { ..._chartOpts, plugins: { legend: { display: false } } }
    });
  }

  function _chartValor(leads) {
    _destroy("valor");
    const STATUS = ["Novo","Contato","Reunião","Proposta","Negociação","Cliente"];
    charts.valor = new Chart(document.getElementById("chart-valor"), {
      type: "bar",
      data: {
        labels: STATUS,
        datasets: [{ label: "R$", data: STATUS.map(s => leads.filter(l => l.status === s).reduce((a,b) => a+(b.valor||0),0)), backgroundColor: CORES, borderRadius: 6 }]
      },
      options: {
        indexAxis: "y",
        plugins: { legend: { display: false } },
        scales: {
          x: { ticks: { color: "#64748b", callback: v => "R$ " + v.toLocaleString("pt-BR") }, grid: { color: "rgba(255,255,255,.04)" } },
          y: { ticks: { color: "#64748b" }, grid: { display: false } }
        }
      }
    });
  }

  function _followupsSemana(leads) {
    const hoje = new Date();
    const em7  = new Date(); em7.setDate(hoje.getDate() + 7);
    const hojeStr = hoje.toISOString().slice(0, 10);
    const em7Str  = em7.toISOString().slice(0, 10);

    const lista = leads
      .filter(l => l.followup && l.followup >= hojeStr && l.followup <= em7Str)
      .sort((a, b) => a.followup.localeCompare(b.followup));

    const el = document.getElementById("followups-semana");
    if (!el) return;

    if (lista.length === 0) {
      el.innerHTML = `<div class="empty"><div class="ei">${ICON.check}</div><p>Nenhum follow-up nos próximos 7 dias.</p></div>`;
      return;
    }

    el.innerHTML = lista.map(l => {
      const cls = l.followup === hojeStr ? "followup-hoje" : "";
      const [y, m, d] = l.followup.split("-");
      return `
        <div class="followup-item ${cls}" style="cursor:pointer" onclick="CRM.abrirModalEditar('${l.id}')">
          <div>
            <div class="empresa">${l.empresa}</div>
            <div style="font-size:11px;color:var(--muted)">${[l.nicho, l.cidade].filter(Boolean).join(" · ")}</div>
          </div>
          <div style="display:flex;align-items:center;gap:8px">
            <span class="data">${ic('calendar',12)} ${d}/${m}/${y}</span>
          </div>
        </div>`;
    }).join("");
  }

  // ── Relatório Semanal ──────────────────────────────────────────────────────
  async function gerarRelatorioSemanal() {
    const btn = document.getElementById("btn-relatorio-semanal");
    if (btn) { btn.disabled = true; btn.textContent = "Gerando..."; }

    try {
      const r  = await Api.get("/relatorio-semanal");
      const el = document.getElementById("relatorio-semanal-conteudo");
      const m  = document.getElementById("modal-relatorio-semanal");

      if (!el || !m) { toast("Erro: modal não encontrado.", "error"); return; }

      const linhasStatus = Object.entries(r.por_status)
        .filter(([, v]) => v > 0)
        .map(([s, v]) => `<div class="rel-row"><span>${s}</span><strong>${v}</strong></div>`)
        .join("");

      const linhasNovos = (r.leads_novos || [])
        .map(l => `<div class="rel-row"><span>${l.empresa}</span><span style="color:var(--muted)">${l.nicho||""}</span></div>`)
        .join("") || `<div style="color:var(--muted);font-size:13px">Nenhum lead novo.</div>`;

      el.innerHTML = `
        <div class="rel-periodo">${ic('calendar',14)} Período: ${r.periodo.inicio} → ${r.periodo.fim}</div>

        <div class="rel-grid">
          <div class="rel-card">
            <div class="rel-num" style="color:var(--cyan)">${r.novos_semana}</div>
            <div class="rel-label">Novos leads</div>
          </div>
          <div class="rel-card">
            <div class="rel-num" style="color:var(--success)">${r.clientes_semana}</div>
            <div class="rel-label">Fechamentos</div>
          </div>
          <div class="rel-card">
            <div class="rel-num" style="color:var(--warn)">R$ ${(r.valor_fechado||0).toLocaleString("pt-BR")}</div>
            <div class="rel-label">Valor fechado</div>
          </div>
          <div class="rel-card">
            <div class="rel-num" style="color:var(--muted)">${r.followups_prox}</div>
            <div class="rel-label">Follow-ups próximos 7 dias</div>
          </div>
        </div>

        <div class="rel-section">
          <h4>Pipeline por Etapa</h4>
          ${linhasStatus}
        </div>

        <div class="rel-section">
          <h4>Leads mais recentes</h4>
          ${linhasNovos}
        </div>`;

      m.classList.add("aberto");
    } catch (e) {
      toast("Erro ao gerar relatório: " + e.message, "error");
    } finally {
      if (btn) { btn.disabled = false; btn.textContent = "Gerar Relatório Semanal"; }
    }
  }

  async function copiarRelatorio() {
    const el = document.getElementById("relatorio-semanal-conteudo");
    if (!el) return;
    try {
      await navigator.clipboard.writeText(el.innerText);
      toast("Relatório copiado!", "success");
    } catch (e) {
      toast("Erro ao copiar.", "error");
    }
  }

  function fecharModalRelatorio() {
    document.getElementById("modal-relatorio-semanal")?.classList.remove("aberto");
  }

  return { render, gerarRelatorioSemanal, copiarRelatorio, fecharModalRelatorio };
})();
