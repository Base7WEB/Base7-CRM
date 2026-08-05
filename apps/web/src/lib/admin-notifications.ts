import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";

// Alertas nunca vao direto pro outbox -- sempre passam pela fila
// (admin_alert_queue) e so viram mensagem quando o cron do digest agrupa.
// Isso evita mandar uma mensagem por evento (spam) e desacopla "aconteceu
// algo" de "quando/como isso vira mensagem".
export async function dispatchToAdminOutbox(
  text: string
): Promise<{ sent: boolean; reason?: string }> {
  const supabaseAdmin = createAdminClient();

  const { data: settings } = await supabaseAdmin
    .from("admin_notification_settings")
    .select("notification_group_jid")
    .eq("id", 1)
    .single();

  if (!settings?.notification_group_jid) {
    return { sent: false, reason: "grupo de notificações do admin não configurado" };
  }

  const { data: admins } = await supabaseAdmin.from("profiles").select("id").eq("role", "ADMIN").eq("is_active", true);

  if (!admins || admins.length === 0) {
    return { sent: false, reason: "nenhum admin ativo" };
  }

  for (const admin of admins) {
    await supabaseAdmin.from("outbox_messages").insert({
      profile_id: admin.id,
      lead_id: null,
      to_phone: settings.notification_group_jid,
      body: text,
    });
  }

  return { sent: true };
}
