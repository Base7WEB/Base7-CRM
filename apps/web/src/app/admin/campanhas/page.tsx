import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { CampanhasClient } from "./campanhas-client";

export default async function CampanhasPage() {
  let profile;
  try {
    profile = await requireAdmin();
  } catch {
    redirect("/");
  }

  return (
    <AppShell profile={profile}>
      <CampanhasClient />
    </AppShell>
  );
}
