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

// Mesmos pesos/regras de apps/web/src/lib/scoring/deterministic.ts --
// reimplementado aqui (script standalone, fora do bundler do Next) só pra
// calcular o score inicial dos leads migrados. Fonte da verdade pra
// scoring em produção é o módulo TS; se os pesos mudarem lá, replicar aqui.
function scoreLeadForMigration(lead) {
  let score = 0;
  if (lead.telefone) score += 10;
  const rating = lead.rating_google;
  if (rating != null) {
    if (rating >= 4.5) score += 15;
    else if (rating >= 4.0) score += 10;
    else if (rating >= 3.0) score += 5;
  }
  const reviews = lead.reviews_google;
  if (reviews != null) {
    if (reviews >= 100) score += 15;
    else if (reviews >= 30) score += 10;
    else if (reviews >= 5) score += 5;
  }
  if (lead.instagram) score += 8;
  if (lead.site) score += 8;
  if (lead.email) score += 4;
  if (lead.cidade) score += 5;
  if (lead.nicho) score += 5;
  // engajamento (respondeu/contato enviado) fica 0 aqui -- leads migrados
  // do JSON nao tem historico de eventos de WhatsApp real, isso e
  // recalculado automaticamente assim que o agente processar uma mensagem.
  score = Math.min(100, score);
  const classificacao = score >= 80 ? "QUENTE" : score >= 60 ? "QUALIFICADO" : score >= 40 ? "MORNO" : "FRIO";
  return { score, classificacao };
}

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

    const nicho = lead.nicho || null;
    const cidade = lead.cidade || null;
    // Bug de coleta do scraper legado: link de Instagram às vezes cai no
    // campo "site" em vez de "instagram". Não corrigido aqui (fora de
    // escopo) -- migrado como está, cada campo pontua o scoring do jeito
    // que realmente está preenchido.
    const instagram = lead.instagram || null;
    const site = lead.site || null;
    const email = lead.email || null;
    const ratingGoogle = typeof lead.rating_google === "number" ? lead.rating_google : null;
    const reviewsGoogle = typeof lead.reviews_google === "number" ? lead.reviews_google : null;

    const { score, classificacao } = scoreLeadForMigration({
      telefone,
      rating_google: ratingGoogle,
      reviews_google: reviewsGoogle,
      instagram,
      site,
      email,
      cidade,
      nicho,
    });

    const row = {
      empresa: lead.empresa || "(sem nome)",
      contato_nome: lead.responsavel || null,
      telefone,
      responsavel_legado_texto: lead.responsavel || null,
      status: STATUS_MAP[lead.status] ?? "NOVO",
      origem: "manual",
      legacy_id: lead.id,
      nicho,
      cidade,
      instagram,
      site,
      email,
      rating_google: ratingGoogle,
      reviews_google: reviewsGoogle,
      score,
      classificacao,
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
