"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SignInState = { error: string | null };

export async function signIn(_prevState: SignInState, formData: FormData): Promise<SignInState> {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    if (error.code === "over_request_rate_limit" || error.status === 429) {
      return { error: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente de novo." };
    }
    if (error.code === "email_not_confirmed") {
      return { error: "E-mail ainda não confirmado. Verifique sua caixa de entrada." };
    }
    return { error: "E-mail ou senha inválidos." };
  }

  redirect("/");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
