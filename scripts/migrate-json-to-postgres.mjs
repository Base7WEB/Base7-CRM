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

const STATUS_MAP = {
  Novo: "NOVO",
  Contato: "CONTATO_REALIZADO",
  "Reunião": "REUNIAO_AGENDADA",
  Proposta: "PROPOSTA_ENVIADA",
  "Negociação": "NEGOCIACAO",
  Cliente: "GANHO",
  Perdido: "PERDIDO",
};

function toE164(telefone, telefoneNormalizado) {
  const digitsOnly = (s) => (s ?? "").replace(/\D/g, "");

  if (telefoneNormalizado) {
    const d = digitsOnly(telefoneNormalizado);
    if (d.length >= 12) return `+${d}`;
  }

  const d = digitsOnly(telefone);
  if (!d) return null;
  if (d.length === 10 || d.length === 11) return `+55${d}`;
  if (d.length === 12 || d.length === 13) return `+${d}`;
  return null;
}

async function main() {
  const env = loadEnv();
  const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const leadsPath = path.join(__dirname, "..", "legacy", "backend", "data", "leads.json");
  const leads = JSON.parse(readFileSync(leadsPath, "utf-8"));

  let inserted = 0;
  let rejected = 0;
  const rejections = [];
  const phoneSeen = new Map();

  for (const lead of leads) {
    const telefone = toE164(lead.telefone, lead.telefone_normalizado);

    if (!telefone) {
      rejected++;
      rejections.push({ empresa: lead.empresa, legacy_id: lead.id, motivo: "sem telefone válido" });
      continue;
    }

    if (phoneSeen.has(telefone)) {
      rejected++;
      rejections.push({
        empresa: lead.empresa,
        legacy_id: lead.id,
        motivo: `telefone duplicado (já usado por "${phoneSeen.get(telefone)}")`,
      });
      continue;
    }
    phoneSeen.set(telefone, lead.empresa);

    const row = {
      empresa: lead.empresa || "(sem nome)",
      contato_nome: lead.responsavel || null,
      telefone,
      responsavel_legado_texto: lead.responsavel || null,
      status: STATUS_MAP[lead.status] ?? "NOVO",
      origem: "manual",
      legacy_id: lead.id,
      created_at: lead.criadoEm ?? new Date().toISOString(),
      updated_at: lead.atualizadoEm ?? new Date().toISOString(),
    };

    const { error } = await supabase.from("leads").upsert(row, { onConflict: "legacy_id" });

    if (error) {
      rejected++;
      rejections.push({ empresa: lead.empresa, legacy_id: lead.id, motivo: error.message });
      continue;
    }

    inserted++;
  }

  console.log(`Total lido: ${leads.length}`);
  console.log(`Inseridos/atualizados: ${inserted}`);
  console.log(`Rejeitados: ${rejected}`);
  if (rejections.length > 0) {
    console.log("\nMotivos de rejeição:");
    for (const r of rejections) {
      console.log(`  - ${r.empresa || "(sem nome)"} [${r.legacy_id}]: ${r.motivo}`);
    }
  }
}

main();
