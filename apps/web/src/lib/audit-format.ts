export type AuditCategory = "usuario" | "lead" | "whatsapp_ok" | "whatsapp_alerta" | "campanha" | "config" | "scraper" | "outro";

export const CATEGORY_BADGE: Record<AuditCategory, string> = {
  usuario: "badge-medium",
  lead: "badge-status",
  whatsapp_ok: "badge-success",
  whatsapp_alerta: "badge-hot",
  campanha: "badge-qualified",
  config: "badge-cold",
  scraper: "badge-success",
  outro: "badge-status",
};

export const CATEGORY_LABEL: Record<AuditCategory, string> = {
  usuario: "Usuário",
  lead: "Lead",
  whatsapp_ok: "WhatsApp",
  whatsapp_alerta: "WhatsApp",
  campanha: "Campanha",
  config: "Configuração",
  scraper: "Scraper",
  outro: "Sistema",
};

export const CATEGORY_FILTERS: { value: string; label: string; categorias: AuditCategory[] }[] = [
  { value: "usuario", label: "Usuário", categorias: ["usuario"] },
  { value: "lead", label: "Lead", categorias: ["lead"] },
  { value: "whatsapp", label: "WhatsApp", categorias: ["whatsapp_ok", "whatsapp_alerta"] },
  { value: "campanha", label: "Campanha", categorias: ["campanha"] },
  { value: "config", label: "Configuração", categorias: ["config"] },
  { value: "scraper", label: "Scraper", categorias: ["scraper"] },
  { value: "outro", label: "Sistema", categorias: ["outro"] },
];

interface AuditLogRow {
  action: string;
  metadata: unknown;
}

export function formatAuditLog(
  log: AuditLogRow,
  { actorName, targetName }: { actorName: string; targetName: string | null }
): { texto: string; categoria: AuditCategory } {
  const m = (log.metadata ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v : "");

  switch (log.action) {
    case "USER_CREATED":
      return {
        texto: `${actorName} convidou ${s(m.full_name) || "um usuário"} (${s(m.email)}) como ${
          m.role === "ADMIN" ? "admin" : "consultor"
        }.`,
        categoria: "usuario",
      };
    case "USER_DEACTIVATED":
      return { texto: `${actorName} desativou ${targetName ?? "um usuário"}.`, categoria: "usuario" };
    case "USER_REACTIVATED":
      return { texto: `${actorName} reativou ${targetName ?? "um usuário"}.`, categoria: "usuario" };
    case "WHATSAPP_AGENT_TOKEN_GENERATED":
      return {
        texto: `${actorName} gerou um novo token de agente WhatsApp para ${s(m.full_name) || "um usuário"}.`,
        categoria: "usuario",
      };
    case "LEAD_REASSIGNED":
      return {
        texto: m.responsavel_novo
          ? `${actorName} atribuiu o lead "${s(m.empresa)}".`
          : `${actorName} removeu o responsável do lead "${s(m.empresa)}".`,
        categoria: "lead",
      };
    case "LEADS_BULK_REASSIGNED":
      return {
        texto: m.responsavel_novo
          ? `${actorName} atribuiu ${m.total ?? 0} lead(s) a ${s(m.responsavel_nome) || "um consultor"}.`
          : `${actorName} removeu o responsável de ${m.total ?? 0} lead(s).`,
        categoria: "lead",
      };
    case "LEAD_STATUS_CHANGED":
      return {
        texto: `${actorName} mudou o status do lead "${s(m.empresa)}" de ${s(m.de)} para ${s(m.para)}.`,
        categoria: "lead",
      };
    case "SCRAPER_LEADS_IMPORTED":
      return {
        texto: `${actorName} importou leads via scraper: ${m.inseridos ?? 0} novos, ${m.duplicados ?? 0} já existiam, ${
          m.rejeitados ?? 0
        } rejeitados.`,
        categoria: "scraper",
      };
    case "WHATSAPP_CONNECTED":
      return { texto: "WhatsApp conectado.", categoria: "whatsapp_ok" };
    case "WHATSAPP_DISCONNECTED":
      return { texto: "WhatsApp desconectado.", categoria: "whatsapp_alerta" };
    case "WHATSAPP_QR_PENDING":
      return { texto: "Aguardando leitura do QR code do WhatsApp.", categoria: "whatsapp_alerta" };
    case "CAMPAIGN_CREATED":
      return {
        texto: `${actorName} criou a campanha "${s(m.nome)}" (${m.leads_incluidos ?? 0} leads).`,
        categoria: "campanha",
      };
    case "CAMPAIGN_STARTED":
      return { texto: `${actorName} iniciou uma campanha (${m.enfileirados ?? 0} leads enfileirados).`, categoria: "campanha" };
    case "CAMPAIGN_PAUSED":
      return { texto: `${actorName} pausou uma campanha.`, categoria: "campanha" };
    case "CAMPAIGN_CANCELLED":
      return { texto: `${actorName} cancelou uma campanha.`, categoria: "campanha" };
    case "CAMPAIGN_LEAD_SKIPPED":
      return { texto: `${actorName} pulou um lead da fila de uma campanha.`, categoria: "campanha" };
    case "CAMPAIGN_DELETED":
      return { texto: `${actorName} excluiu a campanha "${s(m.nome)}".`, categoria: "campanha" };
    case "ADMIN_SETTINGS_CHANGED":
      return { texto: `${actorName} alterou as configurações de notificação do admin.`, categoria: "config" };
    default:
      return { texto: log.action, categoria: "outro" };
  }
}
