export type AlertType = "SALE_WON" | "LEAD_HOT" | "WHATSAPP_DISCONNECTED";

export const ALERT_BADGE: Record<AlertType, string> = {
  SALE_WON: "badge-success",
  LEAD_HOT: "badge-hot",
  WHATSAPP_DISCONNECTED: "badge-hot",
};

export const ALERT_LABEL: Record<AlertType, string> = {
  SALE_WON: "Venda",
  LEAD_HOT: "Lead quente",
  WHATSAPP_DISCONNECTED: "WhatsApp",
};

export const ALERT_FILTERS: { value: AlertType; label: string }[] = [
  { value: "SALE_WON", label: "Vendas" },
  { value: "LEAD_HOT", label: "Leads quentes" },
  { value: "WHATSAPP_DISCONNECTED", label: "WhatsApp" },
];

interface AlertRow {
  type: string;
  payload: unknown;
}

export function formatAlert(alert: AlertRow): string {
  const p = (alert.payload ?? {}) as Record<string, unknown>;
  const s = (v: unknown) => (typeof v === "string" ? v : "");

  switch (alert.type) {
    case "SALE_WON":
      return `🤝 Venda fechada: ${s(p.empresa) || "um lead"}.`;
    case "LEAD_HOT":
      return `🔥 Lead ficou quente: ${s(p.empresa) || "um lead"} (score ${p.score ?? "?"}).`;
    case "WHATSAPP_DISCONNECTED":
      return `🔴 WhatsApp desconectado: ${s(p.full_name) || "um consultor"}.`;
    default:
      return alert.type;
  }
}
