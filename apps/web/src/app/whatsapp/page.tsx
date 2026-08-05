import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { AppShell } from "@/components/app-shell";
import { WhatsappClient } from "./whatsapp-client";

export default async function WhatsappPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();
  const { data: session } = await supabase
    .from("whatsapp_sessions")
    .select("*")
    .eq("profile_id", profile.id)
    .maybeSingle();

  // consultant_agent_tokens é SELECT admin-only na RLS (tokens são
  // sensíveis) -- usa o client de service role, mas sempre escopado ao
  // próprio profile.id vindo da sessão verificada, nunca de input do cliente.
  const supabaseAdmin = createAdminClient();
  const { data: tokenAtivo } = await supabaseAdmin
    .from("consultant_agent_tokens")
    .select("created_at")
    .eq("profile_id", profile.id)
    .is("revoked_at", null)
    .order("created_at", { ascending: false })
    .maybeSingle();

  return (
    <AppShell profile={profile}>
      <div className="topbar">
        <div>
          <h1>WhatsApp</h1>
          <p>Conexão do seu número usado pra falar com os leads.</p>
        </div>
      </div>

      <WhatsappClient
        status={session?.status ?? "DISCONNECTED"}
        lastConnectedAt={session?.last_connected_at ?? null}
        lastDisconnectedAt={session?.last_disconnected_at ?? null}
        temTokenAtivo={!!tokenAtivo}
        tokenGeradoEm={tokenAtivo?.created_at ?? null}
      />
    </AppShell>
  );
}
