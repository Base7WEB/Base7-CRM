import { classificacaoFromScore } from "./types";
import type { LeadScorer, LeadScoringInput, ScoreBreakdownItem, ScoreResult } from "./types";

function hasValue(v: string | null | undefined): boolean {
  return typeof v === "string" && v.trim().length > 0;
}

// Pesos calibrados pra somar 100 no melhor caso. Sinal comportamental real
// (respondeu de verdade no WhatsApp) pesa mais que qualquer dado estático
// coletado pelo scraper, de propósito -- é a evidência mais forte de
// interesse que o sistema tem.
const WEIGHTS = {
  TELEFONE: 10,
  ENGAJAMENTO_RESPONDEU: 30,
  ENGAJAMENTO_CONTATO_SEM_RESPOSTA: 8,
  INSTAGRAM: 8,
  SITE: 8,
  EMAIL: 4,
  RATING_MAX: 15,
  REVIEWS_MAX: 15,
  CIDADE: 5,
  NICHO: 5,
};

function scoreRatingGoogle(rating: number | null): { pontos: number; motivo: string } {
  if (rating == null) return { pontos: 0, motivo: "sem avaliação registrada no Google" };
  if (rating >= 4.5) return { pontos: 15, motivo: `nota ${rating} (excelente, ≥4.5)` };
  if (rating >= 4.0) return { pontos: 10, motivo: `nota ${rating} (boa, ≥4.0)` };
  if (rating >= 3.0) return { pontos: 5, motivo: `nota ${rating} (regular, ≥3.0)` };
  return { pontos: 0, motivo: `nota ${rating} (baixa, <3.0)` };
}

function scoreReviewsGoogle(reviews: number | null): { pontos: number; motivo: string } {
  if (reviews == null) return { pontos: 0, motivo: "sem avaliações registradas" };
  if (reviews >= 100) return { pontos: 15, motivo: `${reviews} avaliações (negócio estabelecido, ≥100)` };
  if (reviews >= 30) return { pontos: 10, motivo: `${reviews} avaliações (ativo, ≥30)` };
  if (reviews >= 5) return { pontos: 5, motivo: `${reviews} avaliações (poucas, ≥5)` };
  return { pontos: 0, motivo: `${reviews} avaliações (muito poucas)` };
}

export const deterministicScorer: LeadScorer = {
  score(input: LeadScoringInput): ScoreResult {
    const breakdown: ScoreBreakdownItem[] = [];

    const temTelefone = hasValue(input.telefone);
    breakdown.push({
      criterio: "Telefone/WhatsApp válido",
      pontos: temTelefone ? WEIGHTS.TELEFONE : 0,
      maximo: WEIGHTS.TELEFONE,
      motivo: temTelefone ? "telefone cadastrado" : "sem telefone válido",
    });

    if (input.hasReplied) {
      breakdown.push({
        criterio: "Engajamento no WhatsApp",
        pontos: WEIGHTS.ENGAJAMENTO_RESPONDEU,
        maximo: WEIGHTS.ENGAJAMENTO_RESPONDEU,
        motivo: "o lead já respondeu pelo menos uma mensagem",
      });
    } else if (input.hasFirstContactSent) {
      breakdown.push({
        criterio: "Engajamento no WhatsApp",
        pontos: WEIGHTS.ENGAJAMENTO_CONTATO_SEM_RESPOSTA,
        maximo: WEIGHTS.ENGAJAMENTO_RESPONDEU,
        motivo: "primeiro contato enviado, ainda sem resposta",
      });
    } else {
      breakdown.push({
        criterio: "Engajamento no WhatsApp",
        pontos: 0,
        maximo: WEIGHTS.ENGAJAMENTO_RESPONDEU,
        motivo: "nenhum contato realizado ainda",
      });
    }

    const temInstagram = hasValue(input.instagram);
    breakdown.push({
      criterio: "Instagram",
      pontos: temInstagram ? WEIGHTS.INSTAGRAM : 0,
      maximo: WEIGHTS.INSTAGRAM,
      motivo: temInstagram ? "perfil de Instagram encontrado" : "sem Instagram identificado",
    });

    const temSite = hasValue(input.site);
    breakdown.push({
      criterio: "Site",
      pontos: temSite ? WEIGHTS.SITE : 0,
      maximo: WEIGHTS.SITE,
      motivo: temSite ? "site encontrado" : "sem site identificado",
    });

    const temEmail = hasValue(input.email);
    breakdown.push({
      criterio: "E-mail",
      pontos: temEmail ? WEIGHTS.EMAIL : 0,
      maximo: WEIGHTS.EMAIL,
      motivo: temEmail ? "e-mail cadastrado" : "sem e-mail cadastrado",
    });

    const rating = scoreRatingGoogle(input.ratingGoogle);
    breakdown.push({ criterio: "Avaliação no Google", pontos: rating.pontos, maximo: WEIGHTS.RATING_MAX, motivo: rating.motivo });

    const reviews = scoreReviewsGoogle(input.reviewsGoogle);
    breakdown.push({ criterio: "Quantidade de avaliações", pontos: reviews.pontos, maximo: WEIGHTS.REVIEWS_MAX, motivo: reviews.motivo });

    const temCidade = hasValue(input.cidade);
    breakdown.push({
      criterio: "Cidade preenchida",
      pontos: temCidade ? WEIGHTS.CIDADE : 0,
      maximo: WEIGHTS.CIDADE,
      motivo: temCidade ? `cidade: ${input.cidade}` : "cidade não identificada",
    });

    const temNicho = hasValue(input.nicho);
    breakdown.push({
      criterio: "Nicho/categoria preenchido",
      pontos: temNicho ? WEIGHTS.NICHO : 0,
      maximo: WEIGHTS.NICHO,
      motivo: temNicho ? `nicho: ${input.nicho}` : "nicho não identificado",
    });

    const score = Math.min(100, breakdown.reduce((sum, item) => sum + item.pontos, 0));

    return { score, classificacao: classificacaoFromScore(score), breakdown };
  },
};
