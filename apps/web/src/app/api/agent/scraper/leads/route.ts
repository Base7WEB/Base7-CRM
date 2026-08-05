import { NextResponse } from "next/server";
import { resolveAgentProfileId } from "@/lib/agent-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { importScrapedLeads, type ScrapedLeadInput } from "@/lib/scraper-import";

export async function POST(request: Request) {
  const profileId = await resolveAgentProfileId(request);
  if (!profileId) {
    return NextResponse.json({ error: "Token inválido ou revogado." }, { status: 401 });
  }

  const body = await request.json();
  const leads: ScrapedLeadInput[] = Array.isArray(body.leads) ? body.leads : [];
  if (leads.length === 0) {
    return NextResponse.json({ error: "leads (array) é obrigatório." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { inseridos, duplicados, rejeitados, motivos } = await importScrapedLeads(supabaseAdmin, profileId, leads);

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: profileId,
    action: "SCRAPER_LEADS_IMPORTED",
    target_table: "leads",
    target_id: null,
    metadata: { total: leads.length, inseridos, duplicados, rejeitados },
  });

  return NextResponse.json({ inseridos, duplicados, rejeitados, motivos: motivos.slice(0, 20) });
}
