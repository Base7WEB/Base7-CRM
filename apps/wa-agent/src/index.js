require("dotenv").config();

const path = require("node:path");
const qrcodeTerminal = require("qrcode-terminal");
const pino = require("pino");
const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} = require("@whiskeysockets/baileys");

const API_BASE_URL = process.env.CRM_API_BASE_URL;
const AGENT_TOKEN = process.env.CRM_AGENT_TOKEN;
const SESSION_DIR = path.join(__dirname, "..", "session-data");

if (!API_BASE_URL || !AGENT_TOKEN) {
  console.error(
    "[wa-agent] Faltam variáveis de ambiente. Configure CRM_API_BASE_URL e CRM_AGENT_TOKEN no .env (ver .env.example)."
  );
  process.exit(1);
}

function extractText(message) {
  if (!message) return null;
  return (
    message.conversation ??
    message.extendedTextMessage?.text ??
    message.imageMessage?.caption ??
    message.videoMessage?.caption ??
    message.documentMessage?.caption ??
    message.buttonsResponseMessage?.selectedDisplayText ??
    message.listResponseMessage?.title ??
    null
  );
}

async function postInbound({ phone, whatsappMessageId, text, direction }) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/agent/whatsapp/inbound`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AGENT_TOKEN}`,
      },
      body: JSON.stringify({ phone, whatsapp_message_id: whatsappMessageId, body: text, direction }),
    });
    if (!res.ok) {
      const errBody = await res.text();
      console.error(`[wa-agent] Falha ao enviar mensagem ${whatsappMessageId} ao CRM: ${res.status} ${errBody}`);
      return;
    }
    console.log(`[wa-agent] Mensagem ${direction === "OUT" ? "enviada" : "recebida"} registrada no CRM (${phone}).`);
  } catch (err) {
    console.error(`[wa-agent] Erro de rede registrando mensagem ${whatsappMessageId}:`, err.message);
  }
}

async function postStatus(status) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/agent/whatsapp/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${AGENT_TOKEN}`,
      },
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error(`[wa-agent] Falha ao reportar status ${status}: ${res.status} ${body}`);
      return;
    }
    console.log(`[wa-agent] Status reportado ao CRM: ${status}`);
  } catch (err) {
    console.error(`[wa-agent] Erro de rede reportando status ${status}:`, err.message);
  }
}

async function connect() {
  const { state, saveCreds } = await useMultiFileAuthState(SESSION_DIR);
  const { version } = await fetchLatestBaileysVersion();

  const socket = makeWASocket({
    auth: state,
    version,
    logger: pino({ level: "silent" }),
  });

  socket.ev.on("creds.update", saveCreds);

  socket.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify" && type !== "append") return;

    for (const msg of messages) {
      const jid = msg.key?.remoteJid;
      if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") continue;

      const text = extractText(msg.message);
      if (!text || !msg.key?.id) continue;

      const phone = jid.split("@")[0];
      const direction = msg.key.fromMe ? "OUT" : "IN";

      await postInbound({ phone, whatsappMessageId: msg.key.id, text, direction });
    }
  });

  socket.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      console.log("[wa-agent] Escaneie o QR code abaixo com o WhatsApp (Aparelhos conectados):");
      qrcodeTerminal.generate(qr, { small: true });
      await postStatus("QR_PENDING");
    }

    if (connection === "open") {
      console.log("[wa-agent] Conectado ao WhatsApp.");
      await postStatus("CONNECTED");
    }

    if (connection === "close") {
      const statusCode = lastDisconnect?.error?.output?.statusCode;
      const loggedOut = statusCode === DisconnectReason.loggedOut;
      await postStatus("DISCONNECTED");

      if (loggedOut) {
        console.error(
          "[wa-agent] Sessão desconectada permanentemente (logout). Apague a pasta session-data/ e rode de novo para parear um novo QR code."
        );
        process.exit(1);
      }

      console.log("[wa-agent] Conexão caiu, tentando reconectar em 5s...");
      setTimeout(connect, 5000);
    }
  });
}

console.log("[wa-agent] Iniciando agente WhatsApp...");
console.log(`[wa-agent] CRM: ${API_BASE_URL}`);
console.log(
  "[wa-agent] Esta janela precisa continuar aberta -- fechá-la interrompe a automação do WhatsApp."
);

connect().catch((err) => {
  console.error("[wa-agent] Erro fatal ao conectar:", err);
  process.exit(1);
});
