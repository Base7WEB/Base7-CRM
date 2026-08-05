import { NextResponse } from "next/server";
import { resolveAgentProfileId } from "@/lib/agent-auth";
import { createAdminClient } from "@/lib/supabase/admin";

// Chamado pelo scraper local em modo watch (polling). Reivindica o pedido
// de busca mais antigo pendente desse mesmo usuário -- claim atômico via
// update condicional (evita dois processos pegarem o mesmo job).
export async function GET(request: Request) {
  const profileId = await resolveAgentProfileId(request);
  if (!profileId) {
    return NextResponse.json({ error: "Token inválido ou revogado." }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();

  const { data: pendente } = await supabaseAdmin
    .from("scraper_jobs")
    .select("id")
    .eq("requested_by", profileId)
    .eq("status", "PENDENTE")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (!pendente) {
    return NextResponse.json({ job: null });
  }

  const { data: job, error } = await supabaseAdmin
    .from("scraper_jobs")
    .update({ status: "EM_ANDAMENTO", started_at: new Date().toISOString() })
    .eq("id", pendente.id)
    .eq("status", "PENDENTE")
    .select("id, modo, params")
    .maybeSingle();

  if (error || !job) {
    // Perdeu a corrida pro claim -- outro processo já pegou. Sem problema,
    // o watcher tenta de novo no próximo tick.
    return NextResponse.json({ job: null });
  }

  return NextResponse.json({ job });
}
