import { NextResponse } from "next/server";
import { requireAdmin, AuthError } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function dayKey(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function renderMensagem(
  texto: string,
  lead: {
    empresa: string | null;
    cidade: string | null;
    nicho: string | null;
    rating_google: number | null;
    site: string | null;
    instagram: string | null;
  },
  responsavelNome: string
): string {
  return (texto || "")
    .replaceAll("{empresa}", lead.empresa ?? "")
    .replaceAll("{responsavel}", responsavelNome)
    .replaceAll("{cidade}", lead.cidade ?? "")
    .replaceAll("{nicho}", lead.nicho ?? "")
    .replaceAll("{rating}", lead.rating_google != null ? String(lead.rating_google) : "")
    .replaceAll("{site}", lead.site ?? "")
    .replaceAll("{instagram}", lead.instagram ?? "");
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let admin;
  try {
    admin = await requireAdmin();
  } catch (err) {
    if (err instanceof AuthError) return NextResponse.json({ error: err.message }, { status: 403 });
    throw err;
  }

  const { id } = await params;
  const supabaseAdmin = createAdminClient();

  const { data: campaign } = await supabaseAdmin.from("campaigns").select("*").eq("id", id).single();
  if (!campaign) return NextResponse.json({ error: "Campanha não encontrada." }, { status: 404 });
  if (campaign.status !== "RASCUNHO" && campaign.status !== "PAUSADA") {
    return NextResponse.json({ error: "Só é possível iniciar campanhas em rascunho ou pausadas." }, { status: 400 });
  }

  const { data: pendentes } = await supabaseAdmin
    .from("campaign_leads")
    .select(
      "id, lead_id, leads(telefone, responsavel_id, empresa, cidade, nicho, rating_google, site, instagram)"
    )
    .eq("campaign_id", id)
    .eq("status", "PENDENTE")
    .order("created_at", { ascending: true });

  if (!pendentes || pendentes.length === 0) {
    return NextResponse.json({ error: "Nenhum lead pendente nesta campanha." }, { status: 400 });
  }

  const { count: enviadosAntes } = await supabaseAdmin
    .from("campaign_leads")
    .select("id", { count: "exact", head: true })
    .eq("campaign_id", id)
    .eq("status", "ENVIADO");

  const restanteLimiteCampanha =
    campaign.limite_campanha != null ? Math.max(0, campaign.limite_campanha - (enviadosAntes ?? 0)) : Infinity;

  if (restanteLimiteCampanha === 0) {
    await supabaseAdmin.from("campaigns").update({ status: "FINALIZADA" }).eq("id", id);
    return NextResponse.json({ error: "Limite de envios da campanha já foi atingido." }, { status: 400 });
  }

  const aProcessar = pendentes.slice(0, restanteLimiteCampanha === Infinity ? pendentes.length : restanteLimiteCampanha);

  const { error: statusError } = await supabaseAdmin.from("campaigns").update({ status: "EM_EXECUCAO" }).eq("id", id);
  if (statusError) {
    return NextResponse.json({ error: "Já existe outra campanha em execução. Finalize ou cancele antes." }, { status: 409 });
  }

  // Nomes dos responsáveis pro placeholder {responsavel}.
  const responsavelIds = [
    ...new Set(
      aProcessar
        .map((item) => (item.leads as unknown as { responsavel_id: string | null } | null)?.responsavel_id)
        .filter((v): v is string => !!v)
    ),
  ];
  const { data: responsaveis } = await supabaseAdmin.from("profiles").select("id, full_name").in("id", responsavelIds);
  const nomeById = new Map((responsaveis ?? []).map((p) => [p.id, p.full_name]));

  const intervaloMin = campaign.modo_conservador ? campaign.intervalo_min_seg * 2 : campaign.intervalo_min_seg;
  const intervaloMax = campaign.modo_conservador ? campaign.intervalo_max_seg * 2 : campaign.intervalo_max_seg;

  let enfileirados = 0;
  const now = Date.now();

  if (campaign.modo_teste) {
    // Modo teste: simula o envio instantaneamente, sem outbox real e sem
    // WhatsApp de verdade -- só pra validar fluxo/mensagem.
    for (const item of aProcessar) {
      const lead = item.leads as unknown as {
        telefone: string;
        responsavel_id: string | null;
        empresa: string;
        cidade: string | null;
        nicho: string | null;
        rating_google: number | null;
        site: string | null;
        instagram: string | null;
      } | null;
      if (!lead?.telefone || !lead.responsavel_id) continue;

      await supabaseAdmin
        .from("campaign_leads")
        .update({
          status: "ENVIADO",
          simulado: true,
          ultimo_envio_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
      enfileirados++;
    }

    // Modo teste conclui tudo na hora (sem agente real confirmando depois) --
    // se não sobrou nenhum lead pendente, a campanha já terminou.
    const { count: restantes } = await supabaseAdmin
      .from("campaign_leads")
      .select("id", { count: "exact", head: true })
      .eq("campaign_id", id)
      .in("status", ["PENDENTE", "ENFILEIRADO"]);
    if ((restantes ?? 0) === 0) {
      await supabaseAdmin.from("campaigns").update({ status: "FINALIZADA" }).eq("id", id).eq("status", "EM_EXECUCAO");
    }
  } else {
    // Escalona por consultor, respeitando o limite diário -- quando um
    // consultor bate o limite do dia, o restante da fila dele pula pro
    // próximo dia às 9h (não perde o lugar, só espera).
    const estadoConsultor = new Map<string, { proximoEnvio: number; dia: string; enviadosHoje: number }>();

    for (const item of aProcessar) {
      const lead = item.leads as unknown as {
        telefone: string;
        responsavel_id: string | null;
        empresa: string;
        cidade: string | null;
        nicho: string | null;
        rating_google: number | null;
        site: string | null;
        instagram: string | null;
      } | null;
      if (!lead?.telefone || !lead.responsavel_id) continue;

      let estado = estadoConsultor.get(lead.responsavel_id);
      if (!estado) {
        estado = { proximoEnvio: now, dia: dayKey(now), enviadosHoje: 0 };
        estadoConsultor.set(lead.responsavel_id, estado);
      }

      const diaAtual = dayKey(estado.proximoEnvio);
      if (diaAtual !== estado.dia) {
        estado.dia = diaAtual;
        estado.enviadosHoje = 0;
      }
      if (estado.enviadosHoje >= campaign.limite_diario) {
        const proximo = new Date(estado.proximoEnvio);
        proximo.setDate(proximo.getDate() + 1);
        proximo.setHours(9, 0, 0, 0);
        estado.proximoEnvio = proximo.getTime();
        estado.dia = dayKey(estado.proximoEnvio);
        estado.enviadosHoje = 0;
      }

      const sendAt = estado.proximoEnvio;
      estado.proximoEnvio = sendAt + randomInt(intervaloMin, intervaloMax) * 1000;
      estado.enviadosHoje++;

      const body = renderMensagem(campaign.corpo_mensagem, lead, nomeById.get(lead.responsavel_id) ?? "");

      const { data: outboxRow, error: outboxError } = await supabaseAdmin
        .from("outbox_messages")
        .insert({
          profile_id: lead.responsavel_id,
          lead_id: item.lead_id,
          campaign_id: id,
          to_phone: lead.telefone,
          body,
          not_before: new Date(sendAt).toISOString(),
        })
        .select()
        .single();

      if (outboxError || !outboxRow) continue;

      await supabaseAdmin
        .from("campaign_leads")
        .update({ status: "ENFILEIRADO", outbox_message_id: outboxRow.id, updated_at: new Date().toISOString() })
        .eq("id", item.id);

      enfileirados++;
    }
  }

  await supabaseAdmin.from("audit_logs").insert({
    actor_id: admin.id,
    action: "CAMPAIGN_STARTED",
    target_table: "campaigns",
    target_id: id,
    metadata: { enfileirados, modo_teste: campaign.modo_teste },
  });

  return NextResponse.json({ ok: true, enfileirados });
}
