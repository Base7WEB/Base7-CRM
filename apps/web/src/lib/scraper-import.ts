import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { toE164 } from "@/lib/phone";
import { recomputeAndSaveLeadScore } from "@/lib/scoring/persist";

export type ScrapedLeadInput = {
  empresa?: string | null;
  nicho?: string | null;
  cidade?: string | null;
  telefone?: string | null;
  instagram?: string | null;
  site?: string | null;
  email?: string | null;
  rating_google?: number | null;
  reviews_google?: number | null;
};

export type ImportItemResult =
  | { status: "inserido"; leadId: string }
  | { status: "duplicado" }
  | { status: "rejeitado"; motivo: string };

export type ImportResult = {
  inseridos: number;
  duplicados: number;
  rejeitados: number;
  motivos: string[];
  itens: ImportItemResult[];
};

// Compartilhado entre o import direto do scraper local (/api/agent/scraper/leads)
// e o import revisado da fila de prospecção (/api/scraper-jobs/[id]/import) --
// mesma regra de normalização/dedup/score pros dois caminhos. "itens" preserva
// a ordem de entrada, pra quem chama conseguir amarrar cada resultado à sua
// linha de origem (ex: marcar um scraper_job_lead como importado).
export async function importScrapedLeads(
  supabaseAdmin: SupabaseClient<Database>,
  responsavelId: string,
  leads: ScrapedLeadInput[]
): Promise<ImportResult> {
  let inseridos = 0;
  let duplicados = 0;
  let rejeitados = 0;
  const motivos: string[] = [];
  const itens: ImportItemResult[] = [];

  for (const raw of leads) {
    const empresa = String(raw.empresa ?? "").trim();
    const telefone = toE164(String(raw.telefone ?? ""));

    if (!empresa) {
      rejeitados++;
      motivos.push("lead sem nome de empresa");
      itens.push({ status: "rejeitado", motivo: "sem nome de empresa" });
      continue;
    }
    if (!telefone) {
      rejeitados++;
      motivos.push(`${empresa}: sem telefone válido`);
      itens.push({ status: "rejeitado", motivo: "sem telefone válido" });
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
        responsavel_id: responsavelId,
        status: "NOVO",
      })
      .select("id")
      .single();

    if (error) {
      if (error.code === "23505") {
        duplicados++;
        itens.push({ status: "duplicado" });
      } else {
        rejeitados++;
        motivos.push(`${empresa}: ${error.message}`);
        itens.push({ status: "rejeitado", motivo: error.message });
      }
      continue;
    }

    await recomputeAndSaveLeadScore(supabaseAdmin, created.id);
    inseridos++;
    itens.push({ status: "inserido", leadId: created.id });
  }

  return { inseridos, duplicados, rejeitados, motivos, itens };
}
