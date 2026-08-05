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

// Leads antigos nunca tiveram a URL exata da ficha do Google Maps salva
// (só passou a ser capturada no scraper a partir de agora). Como
// alternativa, monta um link de busca do Maps por nome + cidade -- não é
// o link original, mas abre o Maps já buscando o negócio certo.
function mapsSearchUrl(empresa, cidade) {
  const query = [empresa, cidade].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
}

async function main() {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: leads, error } = await supabase
    .from("leads")
    .select("id, empresa, cidade, google_maps_url")
    .is("google_maps_url", null);
  if (error) throw new Error(error.message);

  let updated = 0;
  for (const lead of leads) {
    const url = mapsSearchUrl(lead.empresa, lead.cidade);
    const { error: updateError } = await supabase.from("leads").update({ google_maps_url: url }).eq("id", lead.id);
    if (updateError) {
      console.error(`Erro atualizando ${lead.id}:`, updateError.message);
      continue;
    }
    updated++;
  }

  console.log(`Preenchido: ${updated}/${leads.length} leads.`);
}

main();
