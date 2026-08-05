import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { dispatchToAdminOutbox } from "@/lib/admin-notifications";

// Manda uma mensagem de teste pro grupo configurado, na hora -- pra validar
// o JID sem precisar esperar um evento real ou o proximo horario do resumo.
export async function POST() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const result = await dispatchToAdminOutbox(
    "🧪 Teste de notificação do BASE7 CRM — se você recebeu isso, o grupo está configurado corretamente."
  );

  if (!result.sent) {
    return NextResponse.json({ error: result.reason ?? "Falha ao enviar." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
