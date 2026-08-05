import { NextResponse } from "next/server";
import { resolveAgentProfileId } from "@/lib/agent-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { toE164 } from "@/lib/phone";
import { recomputeAndSaveLeadScore } from "@/lib/scoring/persist";

type ScrapedLead = {
  empresa?: string;
  nicho?: string;
  cidade?: string;
  endereco?: string;
  telefone?: string;
  instagram?: string;
  site?: string;
  email?: string;
  rating_google?: number;
  reviews_google?: number;
  origem?: string;
};

export async function POST(request: Request) {
  const profileId = await resolveAgentProfileId(request);
  if (!profileId) {
    return NextResponse.json({ error: "Token inválido ou revogado." }, { status: 401 });
  }

  const body = await request.json();
  const leads: ScrapedLead[] = Array.isArray(body.leads) ? body.leads : [];
  if (leads.length === 0) {
    return NextResponse.json({ error: "leads (array) é obrigatório." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  let inseridos = 0;
  let duplicados = 0;
  let rejeitados = 0;
  const motivos: string[] = [];

  for (const raw of leads) {
    const empresa = String(raw.empresa ?? "").trim();
    const telefone = toE164(String(raw.telefone ?? ""));

    if (!empresa) {
      rejeitados++;
      motivos.push("lead sem nome de empresa");
      continue;
    }
    if (!telefone) {
      rejeitados++;
      motivos.push(`${empresa}: sem telefone válido`);
      continue;
    }

    const { data: created, error } = await supabaseAdmin
      .from("leads")
      .insert({
        empresa,
        telefone,
        nicho: raw.nicho || null,
        cidade: raw.cidade || null,
        instagram: raw.instagram || null,
        site: raw.site || null,
        email: raw.email || null,
        rating_google: typeof raw.rating_google === "number" ? raw.rating_google : null,
        reviews_google: typeof raw.reviews_google === "number" ? raw.reviews_google : null,
        origem: "scraper",
        responsavel_id: profileId,
        status: "NOVO",
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        duplicados++;
      } else {
        rejeitados++;
        motivos.push(`${empresa}: ${error.message}`);
      }
      continue;
    }

    await recomputeAndSaveLeadScore(supabaseAdmin, created.id);
    inseridos++;
  }

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: profileId,
    action: "SCRAPER_LEADS_IMPORTED",
    target_table: "leads",
    target_id: null,
    metadata: { total: leads.length, inseridos, duplicados, rejeitados },
  });

  return NextResponse.json({ inseridos, duplicados, rejeitados, motivos: motivos.slice(0, 20) });
}
