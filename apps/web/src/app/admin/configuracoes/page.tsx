import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { ConfiguracoesClient } from "./configuracoes-client";

export default async function ConfiguracoesPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/");
  }

  return <ConfiguracoesClient />;
}
