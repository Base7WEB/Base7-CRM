import { NextResponse } from "next/server";
import { resolveAgentProfileId } from "@/lib/agent-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { toE164 } from "@/lib/phone";

type ScraperResultLead = {
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
};

// Chamado pelo scraper local ao terminar (ou falhar) um job reivindicado
// via /api/agent/scraper/jobs/next. Resultados viram scraper_job_leads --
// ainda não são leads de verdade, ficam pendentes de revisão/import pela
// tela de Prospecção.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const profileId = await resolveAgentProfileId(request);
  if (!profileId) {
    return NextResponse.json({ error: "Token inválido ou revogado." }, { status: 401 });
  }

  const { id } = await params;
  const body = await request.json();
  const status = body.status === "CONCLUIDO" ? "CONCLUIDO" : body.status === "ERRO" ? "ERRO" : null;
  if (!status) {
    return NextResponse.json({ error: "status deve ser CONCLUIDO ou ERRO." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  // Só o dono do job (mesmo profile_id do token) pode reportar o resultado.
  const { data: job } = await supabaseAdmin
    .from("scraper_jobs")
    .select("id, requested_by, status")
    .eq("id", id)
    .single();

  if (!job || job.requested_by !== profileId) {
    return NextResponse.json({ error: "Job não encontrado." }, { status: 404 });
  }

  if (status === "CONCLUIDO") {
    const leads: ScraperResultLead[] = Array.isArray(body.leads) ? body.leads : [];
    if (leads.length > 0) {
      // Checa contra leads já existentes por telefone (mesma normalização
      // usada na hora de importar de verdade) -- evita que outro consultor
      // fique tentando adivinhar por que um resultado deu "duplicado".
      const telefonesNormalizados = new Map<string, string>();
      for (const l of leads) {
        const e164 = toE164(String(l.telefone ?? ""));
        if (e164) telefonesNormalizados.set(String(l.telefone), e164);
      }

      let responsavelPorTelefone = new Map<string, string>();
      if (telefonesNormalizados.size > 0) {
        const { data: existentes } = await supabaseAdmin
          .from("leads")
          .select("telefone, responsavel_id")
          .in("telefone", [...new Set(telefonesNormalizados.values())]);

        const responsavelIds = [...new Set((existentes ?? []).map((e) => e.responsavel_id).filter((v): v is string => !!v))];
        const { data: perfis } =
          responsavelIds.length > 0 ? await supabaseAdmin.from("profiles").select("id, full_name").in("id", responsavelIds) : { data: [] };
        const nomeById = new Map((perfis ?? []).map((p) => [p.id, p.full_name]));

        responsavelPorTelefone = new Map(
          (existentes ?? []).map((e) => [e.telefone, e.responsavel_id ? nomeById.get(e.responsavel_id) ?? "outro consultor" : "sem responsável"])
        );
      }

      const { error: insertError } = await supabaseAdmin.from("scraper_job_leads").insert(
        leads.map((l) => {
          const e164 = telefonesNormalizados.get(String(l.telefone));
          return {
            job_id: id,
            empresa: String(l.empresa ?? "").trim() || "Empresa sem nome",
            telefone: l.telefone || null,
            endereco: l.endereco || null,
            nicho: l.nicho || null,
            cidade: l.cidade || null,
            instagram: l.instagram || null,
            site: l.site || null,
            email: l.email || null,
            rating_google: typeof l.rating_google === "number" ? l.rating_google : null,
            reviews_google: typeof l.reviews_google === "number" ? l.reviews_google : null,
            responsavel_atual: e164 ? responsavelPorTelefone.get(e164) ?? null : null,
          };
        })
      );
      if (insertError) {
        return NextResponse.json({ error: insertError.message }, { status: 500 });
      }
    }
  }

  const { error } = await supabaseAdmin
    .from("scraper_jobs")
    .update({
      status,
      erro: status === "ERRO" ? String(body.erro ?? "Erro desconhecido") : null,
      finished_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
