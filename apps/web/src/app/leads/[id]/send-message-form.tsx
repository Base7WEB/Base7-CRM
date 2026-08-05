"use client";

import { useState } from "react";

export function SendMessageForm({ leadId }: { leadId: string }) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [queued, setQueued] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    setQueued(false);

    const res = await fetch(`/api/leads/${leadId}/send`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body: text }),
    });
    const json = await res.json();
    setSending(false);

    if (!res.ok) {
      setError(json.error ?? "Erro ao enfileirar mensagem.");
      return;
    }

    setText("");
    setQueued(true);
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2">
      <textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          setQueued(false);
        }}
        placeholder="Escreva a mensagem..."
        rows={3}
      />
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-(--muted)">
          {queued
            ? "Na fila — aparece aqui assim que o agente WhatsApp enviar de verdade."
            : "Entra na fila e é enviada pelo agente WhatsApp do responsável assim que ele estiver online."}
        </p>
        <button type="submit" disabled={sending || !text.trim()} className="btn shrink-0">
          {sending && <span className="loader" />}
          {sending ? "Enviando..." : "Enviar"}
        </button>
      </div>
      {error && <p className="text-sm text-(--danger)">{error}</p>}
    </form>
  );
}
