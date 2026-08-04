"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Status = "checking" | "ready" | "invalid" | "saving" | "done";

export default function SetPasswordPage() {
  const router = useRouter();
  const [status, setStatus] = useState<Status>("checking");
  const [error, setError] = useState<string | null>(null);
  const [password, setPassword] = useState("");

  useEffect(() => {
    const supabase = createClient();

    async function resolveSession() {
      const params = new URLSearchParams(window.location.search);
      const tokenHash = params.get("token_hash");
      const type = params.get("type");

      if (tokenHash && type) {
        const { error: verifyError } = await supabase.auth.verifyOtp({
          token_hash: tokenHash,
          type: type as "invite" | "recovery" | "email",
        });
        if (verifyError) {
          setStatus("invalid");
          return;
        }
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      setStatus(session ? "ready" : "invalid");
    }

    resolveSession();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) setStatus((s) => (s === "checking" ? "ready" : s));
    });

    return () => subscription.unsubscribe();
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("saving");
    setError(null);

    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({ password });

    if (updateError) {
      setError(updateError.message);
      setStatus("ready");
      return;
    }

    setStatus("done");
    router.replace("/");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-sm rounded-lg border border-neutral-200 bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-neutral-900">BASE7 CRM</h1>

        {status === "checking" && (
          <p className="mt-4 text-sm text-neutral-500">Validando convite...</p>
        )}

        {status === "invalid" && (
          <p className="mt-4 text-sm text-red-600">
            Link inválido ou expirado. Peça um novo convite ao administrador.
          </p>
        )}

        {(status === "ready" || status === "saving") && (
          <form onSubmit={handleSubmit} className="mt-4 space-y-4">
            <p className="text-sm text-neutral-500">Defina sua senha de acesso.</p>
            <div className="space-y-1">
              <label htmlFor="password" className="text-sm font-medium text-neutral-700">
                Nova senha
              </label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-md border border-neutral-300 px-3 py-2 text-sm focus:border-neutral-500 focus:outline-none"
              />
            </div>
            {error && (
              <p className="text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
            <button
              type="submit"
              disabled={status === "saving"}
              className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            >
              {status === "saving" ? "Salvando..." : "Salvar e entrar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
