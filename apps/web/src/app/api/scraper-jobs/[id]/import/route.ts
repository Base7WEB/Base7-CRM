import { NextResponse } from "next/server";
import { requireActiveUser, AuthError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { importScrapedLeads } from "@/lib/scraper-import";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let profile;
  try {
    profile = await requireActiveUser();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 401 });
    throw err;
  }

  const { id } = await params;
  const body = await request.json();
  const jobLeadIds: string[] = Array.isArray(body.job_lead_ids) ? body.job_lead_ids.map(String) : [];

  const supabaseAdmin = createAdminClient();

  const { data: job } = await supabaseAdmin.from("scraper_jobs").select("id, requested_by, status").eq("id", id).single();
  if (!job) return NextResponse.json({ error: "Job não encontrado." }, { status: 404 });
  if (job.requested_by !== profile.id && profile.role !== "ADMIN") {
    return NextResponse.json({ error: "Você só pode importar os resultados da sua própria busca." }, { status: 403 });
  }

  let query = supabaseAdmin.from("scraper_job_leads").select("*").eq("job_id", id).eq("importado", false);
  if (jobLeadIds.length > 0) query = query.in("id", jobLeadIds);
  const { data: candidatos } = await query;

  if (!candidatos || candidatos.length === 0) {
    return NextResponse.json({ error: "Nenhum resultado pendente de importação." }, { status: 400 });
  }

  const resultado = await importScrapedLeads(
    supabaseAdmin,
    job.requested_by,
    candidatos.map((c) => ({
      empresa: c.empresa,
      nicho: c.nicho,
      cidade: c.cidade,
      telefone: c.telefone,
      instagram: c.instagram,
      site: c.site,
      email: c.email,
      rating_google: c.rating_google,
      reviews_google: c.reviews_google,
      google_maps_url: c.google_maps_url,
    }))
  );

  await Promise.all(
    resultado.itens.map((item, i) => {
      const candidato = candidatos[i];
      if (item.status === "inserido") {
        return supabaseAdmin
          .from("scraper_job_leads")
          .update({ importado: true, lead_id: item.leadId })
          .eq("id", candidato.id);
      }
      // Duplicado (já existe lead com esse telefone) ou rejeitado (sem
      // telefone válido, por exemplo) -- marca como importado igual, pra
      // sair da lista de pendentes, já que reprocessar não vai mudar nada.
      return supabaseAdmin.from("scraper_job_leads").update({ importado: true }).eq("id", candidato.id);
    })
  );

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: profile.id,
    action: "SCRAPER_LEADS_IMPORTED",
    target_table: "leads",
    target_id: null,
    metadata: { total: candidatos.length, inseridos: resultado.inseridos, duplicados: resultado.duplicados, rejeitados: resultado.rejeitados },
  });

  return NextResponse.json({
    inseridos: resultado.inseridos,
    duplicados: resultado.duplicados,
    rejeitados: resultado.rejeitados,
  });
}
