import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { enviarRelatorio, type Periodo } from "@/lib/reports";

const PERIODOS_VALIDOS: Periodo[] = ["diario", "semanal", "mensal"];

// Disparo manual -- ignora as guardas de "já enviado hoje/essa semana/esse
// mês" do cron, sempre gera e manda na hora. Não mexe nos campos
// last_*_summary_sent_on: é um envio avulso, não substitui o agendado.
export async function POST(request: Request, { params }: { params: Promise<{ periodo: string }> }) {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const { periodo } = await params;
  if (!PERIODOS_VALIDOS.includes(periodo as Periodo)) {
    return NextResponse.json({ error: "Período inválido." }, { status: 400 });
  }

  const resultado = await enviarRelatorio(periodo as Periodo, new Date(), { forcar: true });
  if (!resultado.sent) {
    return NextResponse.json({ error: resultado.reason ?? "Não foi possível enviar." }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
