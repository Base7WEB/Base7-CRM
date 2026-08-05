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
        className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
      />
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">
          {queued
            ? "Na fila — aparece aqui assim que o agente WhatsApp enviar de verdade."
            : "Entra na fila e é enviada pelo agente WhatsApp do responsável assim que ele estiver online."}
        </p>
        <button
          type="submit"
          disabled={sending || !text.trim()}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {sending ? "Enviando..." : "Enviar"}
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
