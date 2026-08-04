const Whatsapp = (() => {
  let statusAtual = "desconectado";

  // ── Abas internas do módulo ────────────────────────────────────────────────
  function _showTab(nome, btn) {
    document.querySelectorAll("#view-whatsapp .tab-btn").forEach(b => b.classList.remove("ativo"));
    btn.classList.add("ativo");
    ["conexao", "dashboard", "campanhas", "conversas"].forEach(n => {
      const el = document.getElementById(`wa-panel-${n}`);
      if (el) el.style.display = n === nome ? "" : "none";
    });
    if (nome === "dashboard" && typeof WhatsappDashboard !== "undefined") WhatsappDashboard.render();
    if (nome === "campanhas" && typeof Campanhas !== "undefined") Campanhas.render();
    if (nome === "conversas" && typeof Conversas !== "undefined") Conversas.render();
  }

  function entrarNaView() {
    atualizarStatus();
  }

  // ── Status / QR (polling contínuo, iniciado em init()) ─────────────────────
  async function atualizarStatus() {
    try {
      const st = await Api.get("/whatsapp/status");
      _renderStatus(st);
    } catch (e) {
      // Backend indisponível — App.verificarBackend já cobre esse aviso global.
    }
  }

  function _renderStatus(st) {
    statusAtual = st.status;

    const elDesconectado = document.getElementById("wa-conexao-desconectado");
    const elQr           = document.getElementById("wa-conexao-qr");
    const elAtiva         = document.getElementById("wa-conexao-ativa");
    const elErro          = document.getElementById("wa-conexao-erro");
    if (!elDesconectado) return; // view ainda não renderizada

    elDesconectado.style.display = "none";
    elQr.style.display           = "none";
    elAtiva.style.display        = "none";
    elErro.style.display         = "none";

    if (st.status === "conectado") {
      elAtiva.style.display = "";
      document.getElementById("wa-numero-conectado").textContent =
        st.numero || "Número não identificado";
    } else if (st.status === "conectando" || st.status === "aguardando_qr") {
      elQr.style.display = "";
      document.getElementById("wa-qr-status").textContent =
        st.status === "conectando" ? "Abrindo WhatsApp Web..." : "Aguardando conexão...";
      if (st.status === "aguardando_qr") _atualizarQr();
    } else if (st.status === "erro") {
      elDesconectado.style.display = "";
      elErro.style.display         = "";
      document.getElementById("wa-erro-txt").textContent =
        st.erro || "Erro desconhecido ao conectar.";
    } else {
      elDesconectado.style.display = "";
    }
  }

  async function _atualizarQr() {
    try {
      const r = await Api.get("/whatsapp/qr");
      if (r.qr) {
        document.getElementById("wa-qr-img").src = `data:image/png;base64,${r.qr}`;
      }
    } catch (e) { /* silencioso */ }
  }

  // ── Ações ────────────────────────────────────────────────────────────────
  async function conectar() {
    try {
      await Api.post("/whatsapp/connect", {});
      toast("Conectando ao WhatsApp...", "info");
      await atualizarStatus();
    } catch (e) {
      toast("Erro ao conectar: " + e.message, "error");
    }
  }

  async function desconectar() {
    if (!confirm("Desconectar o WhatsApp? Campanhas em execução serão pausadas.")) return;
    try {
      await Api.post("/whatsapp/disconnect", {});
      toast("WhatsApp desconectado.", "info");
      await atualizarStatus();
    } catch (e) {
      toast("Erro ao desconectar: " + e.message, "error");
    }
  }

  function conectado() {
    return statusAtual === "conectado";
  }

  // ── Init ────────────────────────────────────────────────────────────────
  function init() {
    atualizarStatus();
    setInterval(atualizarStatus, 4000);
  }

  return { _showTab, entrarNaView, atualizarStatus, conectar, desconectar, conectado, init };
})();
