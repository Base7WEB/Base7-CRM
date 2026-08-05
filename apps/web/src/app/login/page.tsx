"use client";

import { useActionState } from "react";
import Image from "next/image";
import { signIn } from "./actions";

export default function LoginPage() {
  const [state, formAction, pending] = useActionState(signIn, { error: null });

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <form action={formAction} className="box w-full max-w-sm !mb-0">
        <div className="mb-6 flex flex-col items-center text-center">
          <Image src="/logo.png" alt="Base7 Web" width={929} height={409} className="mb-3 w-40" priority />
          <p className="text-xs uppercase tracking-[2px] text-(--muted)">CRM · Entre com sua conta</p>
        </div>

        <div className="mb-3">
          <label htmlFor="email">E-mail</label>
          <input id="email" name="email" type="email" required autoComplete="email" />
        </div>

        <div className="mb-1">
          <label htmlFor="password">Senha</label>
          <input id="password" name="password" type="password" required autoComplete="current-password" />
        </div>

        {state.error && (
          <p className="mt-3 text-sm text-(--danger)" role="alert">
            {state.error}
          </p>
        )}

        <button type="submit" disabled={pending} className="btn mt-5 w-full justify-center">
          {pending && <span className="loader" />}
          {pending ? "Entrando..." : "Entrar"}
        </button>
      </form>
    </div>
  );
}
