const Notificacoes = (() => {
  let aberto = false;

  async function poll() {
    try {
      const notifs = await Api.get("/notifications");
      const naoLidas = notifs.filter(n => !n.lida).length;
      const badge = document.getElementById("notif-badge");
      if (badge) {
        badge.style.display = naoLidas > 0 ? "" : "none";
        badge.textContent = naoLidas;
      }
      if (aberto) _renderPainel(notifs);
    } catch (e) { /* silencioso */ }
  }

  function toggle() {
    aberto = !aberto;
    const painel = document.getElementById("notif-painel");
    if (painel) painel.style.display = aberto ? "" : "none";
    if (aberto) poll();
  }

  function _renderPainel(notifs) {
    const painel = document.getElementById("notif-painel");
    if (!painel) return;
    if (!notifs.length) {
      painel.innerHTML = `<p style="padding:16px;color:var(--muted);font-size:12.5px">Nenhuma notificação ainda.</p>`;
      return;
    }
    painel.innerHTML = notifs.slice(0, 30).map(n => `
      <div style="padding:12px 14px;border-bottom:1px solid var(--border);cursor:pointer;${n.lida ? "opacity:.55" : ""}"
           onclick="Notificacoes.abrir('${n.id}','${n.lead_id || ""}')">
        <strong style="font-size:12.5px">${n.titulo}</strong>
        ${n.detalhe ? `<p style="font-size:11.5px;color:var(--muted);margin-top:2px">${n.detalhe}</p>` : ""}
        <p style="font-size:11px;color:var(--muted);margin-top:2px">${_tempoRelativo(n.criada_em)}</p>
      </div>`).join("");
  }

  function _tempoRelativo(iso) {
    if (!iso) return "";
    const diffMs = Date.now() - new Date(iso).getTime();
    const min = Math.floor(diffMs / 60000);
    if (min < 1) return "agora";
    if (min < 60) return `há ${min} min`;
    const h = Math.floor(min / 60);
    if (h < 24) return `há ${h}h`;
    return `há ${Math.floor(h / 24)}d`;
  }

  async function abrir(notifId, leadId) {
    try { await Api.post(`/notifications/${notifId}/read`, {}); } catch (e) { /* silencioso */ }
    toggle();
    if (leadId) {
      App.navegarPara("whatsapp");
      Whatsapp._showTab("conversas", document.getElementById("wa-tab-conversas"));
      setTimeout(() => Conversas.abrir(leadId), 300);
    }
    poll();
  }

  function init() {
    poll();
    setInterval(poll, 15000);
  }

  return { toggle, abrir, init };
})();
