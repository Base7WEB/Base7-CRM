"use client";

import { useEffect, useState, useCallback } from "react";
import type { Profile } from "@/lib/auth";

type WhatsAppSession = {
  status: "DISCONNECTED" | "QR_PENDING" | "CONNECTED";
  last_connected_at: string | null;
  last_disconnected_at: string | null;
};

type UserRow = Profile & { whatsapp_sessions: WhatsAppSession | null };

const STATUS_BADGE: Record<WhatsAppSession["status"], string> = {
  CONNECTED: "🟢 Conectado",
  QR_PENDING: "🟡 Aguardando QR",
  DISCONNECTED: "🔴 Desconectado",
};

export function UsuariosClient() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [newTokenFor, setNewTokenFor] = useState<{ userId: string; token: string } | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/users");
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro ao carregar usuários.");
    } else {
      setUsers(json.users);
      setError(null);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(formData: FormData) {
    setCreating(true);
    setError(null);
    const res = await fetch("/api/admin/users", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: formData.get("email"),
        full_name: formData.get("full_name"),
        role: formData.get("role"),
      }),
    });
    const json = await res.json();
    setCreating(false);
    if (!res.ok) {
      setError(json.error ?? "Erro ao criar usuário.");
      return;
    }
    await load();
  }

  async function toggleActive(id: string, next: boolean) {
    setError(null);
    const res = await fetch(`/api/admin/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_active: next }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro ao atualizar usuário.");
      return;
    }
    await load();
  }

  async function generateAgentToken(userId: string) {
    setError(null);
    setNewTokenFor(null);
    const res = await fetch("/api/whatsapp-agents", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ profile_id: userId }),
    });
    const json = await res.json();
    if (!res.ok) {
      setError(json.error ?? "Erro ao gerar token.");
      return;
    }
    setNewTokenFor({ userId, token: json.token });
    await load();
  }

  return (
    <>
      <div className="topbar">
        <div>
          <h1>Consultores</h1>
          <p>Convide, desative e gerencie o WhatsApp de cada consultor.</p>
        </div>
      </div>

      <form action={handleCreate} className="box flex flex-wrap items-end gap-3">
        <div className="min-w-[160px] flex-1">
          <label>Nome</label>
          <input name="full_name" required />
        </div>
        <div className="min-w-[200px] flex-1">
          <label>E-mail</label>
          <input name="email" type="email" required />
        </div>
        <div className="min-w-[180px]">
          <label>Papel</label>
          <select name="role">
            <option value="CONSULTOR_COMERCIAL">Consultor comercial</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <button type="submit" disabled={creating} className="btn">
          {creating && <span className="loader" />}
          {creating ? "Convidando..." : "Convidar"}
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-(--danger)">{error}</p>}

      <div className="box">
        {loading ? (
          <p className="empty">Carregando...</p>
        ) : users.length === 0 ? (
          <p className="empty">Nenhum usuário ainda.</p>
        ) : (
          <div className="divide-y divide-(--border)">
            {users.map((u) => (
              <div key={u.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-white">{u.full_name}</p>
                    <p className="text-xs text-(--muted)">
                      {u.email} · {u.role === "ADMIN" ? "Admin" : "Consultor"} ·{" "}
                      <span className={u.is_active ? "text-(--success)" : "text-(--danger)"}>
                        {u.is_active ? "Ativo" : "Inativo"}
                      </span>{" "}
                      · {STATUS_BADGE[u.whatsapp_sessions?.status ?? "DISCONNECTED"]}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => generateAgentToken(u.id)} className="btn-outline btn-sm">
                      Gerar token WhatsApp
                    </button>
                    <button onClick={() => toggleActive(u.id, !u.is_active)} className="btn-ghost btn-sm">
                      {u.is_active ? "Desativar" : "Reativar"}
                    </button>
                  </div>
                </div>

                {newTokenFor?.userId === u.id && (
                  <div className="mt-3 rounded-lg border border-(--warn)/30 bg-(--warn)/10 p-3 text-xs text-amber-200">
                    <p className="font-semibold">Token gerado — copie agora, ele não será mostrado de novo:</p>
                    <code className="mt-2 block break-all rounded-md bg-black/30 px-2 py-1.5 font-mono text-amber-100">
                      {newTokenFor.token}
                    </code>
                    <p className="mt-2 text-amber-200/80">
                      Configure no <code>.env</code> do agente local (<code>apps/wa-agent</code>) como{" "}
                      <code>CRM_AGENT_TOKEN</code>.
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
