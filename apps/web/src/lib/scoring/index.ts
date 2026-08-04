import { deterministicScorer } from "./deterministic";
import type { LeadScoringInput, ScoreResult } from "./types";

export type { Classificacao, LeadScorer, LeadScoringInput, ScoreBreakdownItem, ScoreResult } from "./types";

// Seam único: todo o resto do CRM chama scoreLead(), nunca o
// deterministicScorer diretamente. Trocar/complementar com IA no futuro é
// mudar esta linha (ou compor os dois scorers aqui), sem tocar nas rotas
// nem na UI que já consomem scoreLead().
const activeScorer = deterministicScorer;

export function scoreLead(input: LeadScoringInput): ScoreResult {
  return activeScorer.score(input);
}
