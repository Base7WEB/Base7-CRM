import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function loadEnv() {
  const envPath = path.join(__dirname, "..", "apps", "web", ".env.local");
  return Object.fromEntries(
    readFileSync(envPath, "utf-8")
      .split("\n")
      .filter((line) => line.includes("="))
      .map((line) => {
        const idx = line.indexOf("=");
        return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
      })
  );
}

// Mesma logica de apps/web/src/lib/scoring/deterministic.ts.
function score(input) {
  let s = 0;
  if (input.telefone) s += 10;
  if (input.hasReplied) s += 30;
  else if (input.hasFirstContactSent) s += 8;
  if (input.rating_google != null) {
    if (input.rating_google >= 4.5) s += 15;
    else if (input.rating_google >= 4.0) s += 10;
    else if (input.rating_google >= 3.0) s += 5;
  }
  if (input.reviews_google != null) {
    if (input.reviews_google >= 100) s += 15;
    else if (input.reviews_google >= 30) s += 10;
    else if (input.reviews_google >= 5) s += 5;
  }
  if (input.instagram) s += 8;
  if (input.site) s += 8;
  if (input.email) s += 4;
  if (input.cidade) s += 5;
  if (input.nicho) s += 5;
  s = Math.min(100, s);
  const classificacao = s >= 80 ? "QUENTE" : s >= 60 ? "QUALIFICADO" : s >= 40 ? "MORNO" : "FRIO";
  return { score: s, classificacao };
}

async function main() {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, telefone, nicho, cidade, instagram, site, email, rating_google, reviews_google");
  if (error) throw new Error(error.message);

  const { data: events, error: eventsError } = await supabase
    .from("lead_events")
    .select("lead_id, type")
    .in("type", ["FIRST_CONTACT_SENT", "LEAD_REPLIED"]);
  if (eventsError) throw new Error(eventsError.message);

  const eventsByLead = new Map();
  for (const e of events) {
    if (!eventsByLead.has(e.lead_id)) eventsByLead.set(e.lead_id, new Set());
    eventsByLead.get(e.lead_id).add(e.type);
  }

  let updated = 0;
  for (const lead of leads) {
    const types = eventsByLead.get(lead.id) ?? new Set();
    const result = score({
      ...lead,
      hasReplied: types.has("LEAD_REPLIED"),
      hasFirstContactSent: types.has("FIRST_CONTACT_SENT"),
    });
    const { error: updateError } = await supabase
      .from("leads")
      .update({ score: result.score, classificacao: result.classificacao })
      .eq("id", lead.id);
    if (updateError) {
      console.error(`Erro atualizando ${lead.id}:`, updateError.message);
      continue;
    }
    updated++;
  }

  console.log(`Recalculado: ${updated}/${leads.length} leads.`);
}

main();
