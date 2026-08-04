import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const { id } = await params;
  const body = await request.json();
  const isActive = Boolean(body.is_active);

  if (id === admin.id && !isActive) {
    return NextResponse.json({ error: "Você não pode desativar sua própria conta." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  const { error: profileError } = await supabaseAdmin
    .from("profiles")
    .update({ is_active: isActive })
    .eq("id", id);
  if (profileError) {
    return NextResponse.json({ error: profileError.message }, { status: 500 });
  }

  const { error: banError } = await supabaseAdmin.auth.admin.updateUserById(id, {
    ban_duration: isActive ? "none" : "876000h",
  });
  if (banError) {
    return NextResponse.json({ error: banError.message }, { status: 500 });
  }

  if (!isActive) {
    await supabaseAdmin.auth.admin.signOut(id, "global");
  }

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: admin.id,
    action: isActive ? "USER_REACTIVATED" : "USER_DEACTIVATED",
    target_table: "profiles",
    target_id: id,
    metadata: {},
  });

  return NextResponse.json({ ok: true });
}
