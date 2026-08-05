import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET() {
  try {
    await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const supabaseAdmin = createAdminClient();
  const { data: campaigns, error } = await supabaseAdmin
    .from("campaigns")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const results = await Promise.all(
    (campaigns ?? []).map(async (c) => {
      const { data: leads } = await supabaseAdmin.from("campaign_leads").select("status").eq("campaign_id", c.id);
      const counts = { total: leads?.length ?? 0, enviado: 0, falhou: 0, pulado: 0, pendente: 0 };
      for (const l of leads ?? []) {
        if (l.status === "ENVIADO") counts.enviado++;
        else if (l.status === "FALHOU") counts.falhou++;
        else if (l.status === "PULADO") counts.pulado++;
        else counts.pendente++;
      }
      return { ...c, counts };
    })
  );

  return NextResponse.json({ campaigns: results });
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
  const nome = String(body.nome ?? "").trim();
  const descricao = String(body.descricao ?? "").trim();
  const nicho = String(body.nicho ?? "").trim() || null;
  const cidade = String(body.cidade ?? "").trim() || null;
  const tags: string[] = Array.isArray(body.tags) ? body.tags.map(String).filter(Boolean) : [];
  const leadIds: string[] = Array.isArray(body.lead_ids)
    ? Array.from(new Set<string>(body.lead_ids.map((v: unknown) => String(v))))
    : [];
  const corpoMensagem = String(body.corpo_mensagem ?? "").trim();
  const followups: { dias: number; texto: string }[] = Array.isArray(body.followups)
    ? body.followups
        .map((f: unknown) => {
          const fo = f as { dias?: unknown; texto?: unknown };
          return { dias: Number(fo.dias) || 0, texto: String(fo.texto ?? "").trim() };
        })
        .filter((f: { dias: number; texto: string }) => f.texto && f.dias > 0)
    : [];
  const intervaloMin = Number(body.intervalo_min_seg ?? 20);
  const intervaloMax = Number(body.intervalo_max_seg ?? 60);
  const limiteDiario = Number(body.limite_diario ?? 80);
  const limiteCampanhaRaw = Number(body.limite_campanha ?? 0);
  const limiteCampanha = limiteCampanhaRaw > 0 ? limiteCampanhaRaw : null;
  const modoConservador = Boolean(body.modo_conservador);
  const modoTeste = Boolean(body.modo_teste);

  if (!nome || !corpoMensagem) {
    return NextResponse.json({ error: "Nome e mensagem são obrigatórios." }, { status: 400 });
  }
  if (leadIds.length === 0) {
    return NextResponse.json({ error: "Selecione ao menos 1 lead para a campanha." }, { status: 400 });
  }
  if (intervaloMin < 5 || intervaloMax < intervaloMin) {
    return NextResponse.json({ error: "Intervalo mínimo deve ser >= 5s e menor ou igual ao máximo." }, { status: 400 });
  }

  const supabaseAdmin = createAdminClient();

  // Só entram leads com responsável definido -- sem isso não tem de qual
  // WhatsApp enviar.
  const { data: leadsValidos } = await supabaseAdmin
    .from("leads")
    .select("id")
    .in("id", leadIds)
    .not("responsavel_id", "is", null);
  const idsValidos = new Set((leadsValidos ?? []).map((l) => l.id));
  const idsFiltrados = leadIds.filter((id) => idsValidos.has(id));

  if (idsFiltrados.length === 0) {
    return NextResponse.json(
      { error: "Nenhum dos leads selecionados tem responsável definido." },
      { status: 400 }
    );
  }

  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from("campaigns")
    .insert({
      nome,
      descricao,
      nicho,
      cidade,
      tags,
      corpo_mensagem: corpoMensagem,
      intervalo_min_seg: intervaloMin,
      intervalo_max_seg: intervaloMax,
      limite_diario: limiteDiario,
      limite_campanha: limiteCampanha,
      modo_conservador: modoConservador,
      modo_teste: modoTeste,
      created_by: admin.id,
    })
    .select()
    .single();

  if (campaignError || !campaign) {
    return NextResponse.json({ error: campaignError?.message ?? "Erro ao criar campanha." }, { status: 500 });
  }

  await supabaseAdmin
    .from("campaign_leads")
    .insert(idsFiltrados.map((id) => ({ campaign_id: campaign.id, lead_id: id })));

  if (followups.length > 0) {
    await supabaseAdmin.from("campaign_followups").insert(
      followups.map((f, i) => ({ campaign_id: campaign.id, ordem: i, dias: f.dias, texto: f.texto }))
    );
  }

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: admin.id,
    action: "CAMPAIGN_CREATED",
    target_table: "campaigns",
    target_id: campaign.id,
    metadata: {
      nome,
      leads_incluidos: idsFiltrados.length,
      leads_ignorados_sem_responsavel: leadIds.length - idsFiltrados.length,
      followups: followups.length,
      modo_teste: modoTeste,
      modo_conservador: modoConservador,
    },
  });

  return NextResponse.json({ campaign, leads_incluidos: idsFiltrados.length }, { status: 201 });
}
