"use client";

import { useState } from "react";

const STATUS_LABEL: Record<string, string> = {
  CONNECTED: "Conectado",
  QR_PENDING: "Aguardando leitura do QR code",
  DISCONNECTED: "Desconectado",
};

const STATUS_DOT: Record<string, string> = {
  CONNECTED: "online",
  QR_PENDING: "",
  DISCONNECTED: "",
};

export function WhatsappClient({
  status,
  lastConnectedAt,
  lastDisconnectedAt,
  temTokenAtivo,
  tokenGeradoEm,
}: {
  status: string;
  lastConnectedAt: string | null;
  lastDisconnectedAt: string | null;
  temTokenAtivo: boolean;
  tokenGeradoEm: string | null;
}) {
  const [gerando, setGerando] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function gerarToken() {
    if (
      temTokenAtivo &&
      !confirm("Já existe um token ativo. Gerar um novo vai desconectar a sessão atual até você configurar o novo. Continuar?")
    ) {
      return;
    }
    setGerando(true);
    setError(null);
    const res = await fetch("/api/whatsapp-agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    const json = await res.json();
    setGerando(false);
    if (!res.ok) {
      setError(json.error ?? "Erro ao gerar token.");
      return;
    }
    setToken(json.token);
  }

  return (
    <>
      <div className="box max-w-xl">
        <div className="mb-4 flex items-center gap-3">
          <span className={`status-dot ${STATUS_DOT[status] ?? ""}`} />
          <strong>{STATUS_LABEL[status] ?? status}</strong>
        </div>

        {status === "CONNECTED" && lastConnectedAt && (
          <p className="mb-4 text-sm text-(--muted)">Conectado desde {new Date(lastConnectedAt).toLocaleString("pt-BR")}.</p>
        )}
        {status !== "CONNECTED" && lastDisconnectedAt && (
          <p className="mb-4 text-sm text-(--muted)">
            Última desconexão em {new Date(lastDisconnectedAt).toLocaleString("pt-BR")}.
          </p>
        )}

        <div className="rounded-md border border-(--border) bg-(--bg2) p-3 text-sm text-(--text)">
          <p className="mb-2 font-semibold text-white">Como conectar</p>
          <ol className="list-inside list-decimal space-y-1 text-(--muted)">
            <li>
              Gere um token abaixo (se ainda não tiver um) e cole no <code>.env</code> da pasta{" "}
              <code>apps/wa-agent</code>, na chave <code>CRM_AGENT_TOKEN</code>.
            </li>
            <li>
              Dê dois cliques em <code>iniciar.bat</code> dentro de <code>apps/wa-agent</code>.
            </li>
            <li>Um QR code aparece na janela que abrir — escaneie com o WhatsApp em Aparelhos conectados.</li>
            <li>Deixe essa janela aberta enquanto quiser que as mensagens sejam enviadas/recebidas automaticamente.</li>
          </ol>
        </div>

        <div className="mt-4">
          {temTokenAtivo && !token && (
            <p className="mb-2 text-xs text-(--muted)">
              Token ativo gerado em {tokenGeradoEm ? new Date(tokenGeradoEm).toLocaleString("pt-BR") : "—"}.
            </p>
          )}
          <button onClick={gerarToken} disabled={gerando} className="btn-outline btn-sm">
            {gerando && <span className="loader" />}
            {gerando ? "Gerando..." : temTokenAtivo ? "Gerar novo token (revoga o atual)" : "Gerar token"}
          </button>
          {error && <p className="mt-2 text-sm text-(--danger)">{error}</p>}
        </div>

        {token && (
          <div className="mt-3 rounded-lg border border-(--warn)/30 bg-(--warn)/10 p-3 text-xs text-amber-200">
            <p className="font-semibold">Token gerado — copie agora, ele não será mostrado de novo:</p>
            <code className="mt-2 block break-all rounded-md bg-black/30 px-2 py-1.5 font-mono text-amber-100">{token}</code>
            <p className="mt-2 text-amber-200/80">
              Cole no <code>.env</code> de <code>apps/wa-agent</code> (chave <code>CRM_AGENT_TOKEN</code>) — o mesmo token
              também serve pro scraper local, se quiser usar a Prospecção.
            </p>
          </div>
        )}
      </div>
    </>
  );
}
