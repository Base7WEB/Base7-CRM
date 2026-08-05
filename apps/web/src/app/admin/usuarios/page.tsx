import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { UsuariosClient } from "./usuarios-client";

export default async function UsuariosPage() {
  let profile;
  try {
    profile = await requireAdmin();
  } catch {
    redirect("/");
  }

  return (
    <AppShell profile={profile}>
      <UsuariosClient />
    </AppShell>
  );
}
