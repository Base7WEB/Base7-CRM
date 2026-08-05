"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
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
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="box w-full max-w-sm !mb-0">
        <div className="mb-2 flex flex-col items-center text-center">
          <Image src="/logo.png" alt="Base7 Web" width={929} height={409} className="mb-3 w-40" priority />
        </div>

        {status === "checking" && <p className="text-center text-sm text-(--muted)">Validando convite...</p>}

        {status === "invalid" && (
          <p className="text-center text-sm text-(--danger)">
            Link inválido ou expirado. Peça um novo convite ao administrador.
          </p>
        )}

        {(status === "ready" || status === "saving") && (
          <form onSubmit={handleSubmit} className="mt-2">
            <p className="mb-4 text-center text-sm text-(--muted)">Defina sua senha de acesso.</p>
            <div className="mb-1">
              <label htmlFor="password">Nova senha</label>
              <input
                id="password"
                type="password"
                required
                minLength={8}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
            {error && (
              <p className="mt-2 text-sm text-(--danger)" role="alert">
                {error}
              </p>
            )}
            <button type="submit" disabled={status === "saving"} className="btn mt-4 w-full justify-center">
              {status === "saving" && <span className="loader" />}
              {status === "saving" ? "Salvando..." : "Salvar e entrar"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
