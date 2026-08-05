import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, Json } from "@/lib/supabase/types";

type SettingsUpdate = Database["public"]["Tables"]["admin_notification_settings"]["Update"];

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.from("admin_notification_settings").select("*").eq("id", 1).single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data });
}

export async function PATCH(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const body = await request.json();
  const update: SettingsUpdate = {};
  if (typeof body.digest_interval_minutes === "number") update.digest_interval_minutes = body.digest_interval_minutes;
  if (typeof body.daily_summary_time === "string") update.daily_summary_time = body.daily_summary_time;
  if (typeof body.notification_group_jid === "string") {
    update.notification_group_jid = body.notification_group_jid.trim() || null;
  }
  if (typeof body.weekly_summary_weekday === "number") update.weekly_summary_weekday = body.weekly_summary_weekday;
  if (typeof body.weekly_summary_time === "string") update.weekly_summary_time = body.weekly_summary_time;
  if (typeof body.monthly_summary_rule === "string") update.monthly_summary_rule = body.monthly_summary_rule;
  if (typeof body.monthly_summary_time === "string") update.monthly_summary_time = body.monthly_summary_time;

  const supabaseAdmin = createAdminClient();
  const { error } = await supabaseAdmin.from("admin_notification_settings").update(update).eq("id", 1);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: admin.id,
    action: "ADMIN_SETTINGS_CHANGED",
    target_table: "admin_notification_settings",
    target_id: null,
    metadata: update as Json,
  });

  return NextResponse.json({ ok: true });
}
