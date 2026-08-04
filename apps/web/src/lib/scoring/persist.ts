import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { scoreLead } from "./index";
import type { ScoreResult } from "./types";

// Recalcula e grava score/classificacao de um lead. Chamado sempre que um
// dado usado no scoring muda: criação do lead e nos dois eventos
// comportamentais (primeiro contato enviado / lead respondeu).
export async function recomputeAndSaveLeadScore(
  supabaseAdmin: SupabaseClient<Database>,
  leadId: string
): Promise<ScoreResult | null> {
  const { data: lead } = await supabaseAdmin
    .from("leads")
    .select("telefone, nicho, cidade, instagram, site, email, rating_google, reviews_google")
    .eq("id", leadId)
    .single();

  if (!lead) return null;

  const { data: events } = await supabaseAdmin
    .from("lead_events")
    .select("type")
    .eq("lead_id", leadId)
    .in("type", ["FIRST_CONTACT_SENT", "LEAD_REPLIED"]);

  const eventTypes = new Set((events ?? []).map((e) => e.type));

  const result = scoreLead({
    telefone: lead.telefone,
    nicho: lead.nicho,
    cidade: lead.cidade,
    instagram: lead.instagram,
    site: lead.site,
    email: lead.email,
    ratingGoogle: lead.rating_google,
    reviewsGoogle: lead.reviews_google,
    hasReplied: eventTypes.has("LEAD_REPLIED"),
    hasFirstContactSent: eventTypes.has("FIRST_CONTACT_SENT"),
  });

  await supabaseAdmin
    .from("leads")
    .update({ score: result.score, classificacao: result.classificacao })
    .eq("id", leadId);

  return result;
}
