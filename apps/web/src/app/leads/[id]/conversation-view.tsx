"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { SendMessageForm } from "./send-message-form";

type Message = { direction: string; body: string; created_at: string };

export function ConversationView({
  leadId,
  initialMessages,
  canSend,
}: {
  leadId: string;
  initialMessages: Message[];
  canSend: boolean;
}) {
  const [messages, setMessages] = useState<Message[]>(initialMessages);

  useEffect(() => {
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    async function setup() {
      // A avaliacao de RLS no Realtime usa o token de acesso do usuario --
      // sem anexar explicitamente, a inscricao pode se autenticar como
      // anon antes da sessao (via cookies) terminar de carregar, e a
      // policy de messages_select bloqueia os eventos em silencio (sem
      // erro nenhum, so nunca chega nada).
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }

      channel = supabase
        .channel(`messages-lead-${leadId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "messages", filter: `lead_id=eq.${leadId}` },
          (payload) => {
            const row = payload.new as Message;
            setMessages((prev) => [...prev, { direction: row.direction, body: row.body, created_at: row.created_at }]);
          }
        )
        .subscribe((status, err) => {
          if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
            console.error("[wa-realtime] falha na inscrição de mensagens:", status, err);
          }
        });
    }

    setup();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
    };
  }, [leadId]);

  return (
    <div className="mt-4 rounded-lg border border-neutral-200 p-4">
      <p className="text-xs font-medium uppercase text-neutral-500">Conversa</p>
      <div className="mt-2 max-h-80 space-y-2 overflow-y-auto">
        {messages.length === 0 && <p className="text-sm text-neutral-500">Nenhuma mensagem ainda.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.direction === "OUT" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-lg px-3 py-1.5 text-sm ${
                m.direction === "OUT" ? "bg-neutral-900 text-white" : "bg-neutral-100 text-neutral-900"
              }`}
            >
              {m.body}
            </div>
          </div>
        ))}
      </div>
      {canSend ? (
        <div className="mt-3 border-t border-neutral-100 pt-3">
          <SendMessageForm leadId={leadId} />
        </div>
      ) : (
        <p className="mt-3 text-xs text-neutral-500">Só o responsável ou o admin podem enviar mensagens.</p>
      )}
    </div>
  );
}
