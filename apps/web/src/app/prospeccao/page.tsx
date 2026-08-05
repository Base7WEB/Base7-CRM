import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { ProspeccaoClient } from "./prospeccao-client";

export default async function ProspeccaoPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <AppShell profile={profile}>
      <ProspeccaoClient isAdmin={profile.role === "ADMIN"} />
    </AppShell>
  );
}
