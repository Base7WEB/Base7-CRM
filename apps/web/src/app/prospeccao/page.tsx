import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/app-shell";
import { ProspeccaoClient } from "./prospeccao-client";

export default async function ProspeccaoPage({
  searchParams,
}: {
  searchParams: Promise<{ consultor?: string }>;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const { consultor } = await searchParams;
  const isAdmin = profile.role === "ADMIN";

  let consultores: { id: string; full_name: string }[] = [];
  if (isAdmin) {
    const supabaseAdmin = createAdminClient();
    const { data } = await supabaseAdmin
      .from("profiles")
      .select("id, full_name")
      .eq("role", "CONSULTOR_COMERCIAL")
      .eq("is_active", true)
      .order("full_name");
    consultores = data ?? [];
  }

  return (
    <AppShell profile={profile}>
      <ProspeccaoClient isAdmin={isAdmin} consultores={consultores} consultorInicial={consultor ?? ""} />
    </AppShell>
  );
}
