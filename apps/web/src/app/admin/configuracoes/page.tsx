import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { ConfiguracoesClient } from "./configuracoes-client";

export default async function ConfiguracoesPage() {
  let profile;
  try {
    profile = await requireAdmin();
  } catch {
    redirect("/");
  }

  return (
    <AppShell profile={profile}>
      <ConfiguracoesClient />
    </AppShell>
  );
}
