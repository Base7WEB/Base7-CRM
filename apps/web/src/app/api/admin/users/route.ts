import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ users: data });
}

export async function POST(request: Request) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const body = await request.json();
  const email = String(body.email ?? "").trim().toLowerCase();
  const fullName = String(body.full_name ?? "").trim();
  const role = body.role === "ADMIN" ? "ADMIN" : "CONSULTOR_COMERCIAL";

  if (!email || !fullName) {
    return NextResponse.json({ error: "email e full_name são obrigatórios." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.auth.admin.inviteUserByEmail(email, {
    data: { full_name: fullName, role },
    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/set-password`,
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: admin.id,
    action: "USER_CREATED",
    target_table: "profiles",
    target_id: data.user.id,
    metadata: { email, full_name: fullName, role },
  });

  return NextResponse.json({ user: data.user }, { status: 201 });
}
