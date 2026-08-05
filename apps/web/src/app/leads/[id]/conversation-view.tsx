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
    <div className="box">
      <div className="box-header">
        <h2>Conversa</h2>
      </div>
      <div className="max-h-80 space-y-2 overflow-y-auto">
        {messages.length === 0 && <p className="empty">Nenhuma mensagem ainda.</p>}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.direction === "OUT" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[75%] rounded-xl px-3 py-2 text-sm ${
                m.direction === "OUT"
                  ? "bg-gradient-to-br from-(--blue) to-sky-500 text-white"
                  : "bg-(--bg3) text-(--text)"
              }`}
            >
              {m.body}
            </div>
          </div>
        ))}
      </div>
      {canSend ? (
        <div className="mt-3 border-t border-(--border) pt-3">
          <SendMessageForm leadId={leadId} />
        </div>
      ) : (
        <p className="mt-3 text-xs text-(--muted)">Só o responsável ou o admin podem enviar mensagens.</p>
      )}
    </div>
  );
}
