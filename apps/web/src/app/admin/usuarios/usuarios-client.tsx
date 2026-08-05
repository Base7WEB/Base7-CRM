"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
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
    const res = await fetch("/api/admin/whatsapp-agents", {
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
    <div className="mx-auto max-w-3xl px-6 py-10">
      <Link href="/" className="text-sm text-neutral-500 underline">
        ← Voltar
      </Link>
      <h1 className="mt-2 text-lg font-semibold text-neutral-900">Consultores</h1>

      <form
        action={handleCreate}
        className="mt-6 flex flex-wrap items-end gap-3 rounded-lg border border-neutral-200 p-4"
      >
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">Nome</label>
          <input name="full_name" required className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">E-mail</label>
          <input name="email" type="email" required className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm" />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs font-medium text-neutral-600">Papel</label>
          <select name="role" className="rounded-md border border-neutral-300 px-2 py-1.5 text-sm">
            <option value="CONSULTOR_COMERCIAL">Consultor comercial</option>
            <option value="ADMIN">Admin</option>
          </select>
        </div>
        <button
          type="submit"
          disabled={creating}
          className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50"
        >
          {creating ? "Convidando..." : "Convidar"}
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-6 divide-y divide-neutral-200 rounded-lg border border-neutral-200">
        {loading ? (
          <p className="p-4 text-sm text-neutral-500">Carregando...</p>
        ) : users.length === 0 ? (
          <p className="p-4 text-sm text-neutral-500">Nenhum usuário ainda.</p>
        ) : (
          users.map((u) => (
            <div key={u.id} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-neutral-900">{u.full_name}</p>
                  <p className="text-xs text-neutral-500">
                    {u.email} · {u.role === "ADMIN" ? "Admin" : "Consultor"} ·{" "}
                    {u.is_active ? "Ativo" : "Inativo"} ·{" "}
                    {STATUS_BADGE[u.whatsapp_sessions?.status ?? "DISCONNECTED"]}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => generateAgentToken(u.id)}
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                  >
                    Gerar token WhatsApp
                  </button>
                  <button
                    onClick={() => toggleActive(u.id, !u.is_active)}
                    className="rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-700 hover:bg-neutral-50"
                  >
                    {u.is_active ? "Desativar" : "Reativar"}
                  </button>
                </div>
              </div>

              {newTokenFor?.userId === u.id && (
                <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                  <p className="font-medium">
                    Token gerado — copie agora, ele não será mostrado de novo:
                  </p>
                  <code className="mt-1 block break-all rounded bg-white px-2 py-1 font-mono">
                    {newTokenFor.token}
                  </code>
                  <p className="mt-1">
                    Configure no <code>.env</code> do agente local (<code>apps/wa-agent</code>) como{" "}
                    <code>CRM_AGENT_TOKEN</code>.
                  </p>
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
