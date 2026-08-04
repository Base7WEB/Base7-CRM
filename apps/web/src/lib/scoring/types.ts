export type Classificacao = "QUENTE" | "QUALIFICADO" | "MORNO" | "FRIO";

// Entrada do scorer: só campos que o CRM realmente coleta hoje (schema
// public.leads + sinais comportamentais derivados de lead_events). Nenhum
// campo aqui é inventado — todos existem de verdade no banco.
export interface LeadScoringInput {
  telefone: string | null;
  nicho: string | null;
  cidade: string | null;
  instagram: string | null;
  site: string | null;
  email: string | null;
  ratingGoogle: number | null;
  reviewsGoogle: number | null;
  hasReplied: boolean;
  hasFirstContactSent: boolean;
}

export interface ScoreBreakdownItem {
  criterio: string;
  pontos: number;
  maximo: number;
  motivo: string;
}

export interface ScoreResult {
  score: number;
  classificacao: Classificacao;
  breakdown: ScoreBreakdownItem[];
}

// Contrato estável: o resto do CRM (rotas, UI, dashboard) só conhece esta
// interface. O scoring determinístico de hoje é UMA implementação dela —
// trocar por uma versão assistida por IA no futuro (ou combinar as duas)
// significa implementar LeadScorer de novo e trocar o export em
// lib/scoring/index.ts, sem tocar em quem chama scoreLead().
export interface LeadScorer {
  score(input: LeadScoringInput): ScoreResult;
}

export function classificacaoFromScore(score: number): Classificacao {
  if (score >= 80) return "QUENTE";
  if (score >= 60) return "QUALIFICADO";
  if (score >= 40) return "MORNO";
  return "FRIO";
}
