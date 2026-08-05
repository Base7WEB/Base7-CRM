import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Follow-up automático = mesma regra do worker antigo (campaign_worker.py):
// só dispara pra lead que ainda está "Novo" (quem avançou de estágio ou foi
// perdido não recebe mais prospecção automática), que não respondeu desde o
// último envio, e cujo prazo em dias já passou. Chamado com a mesma
// frequência do digest do admin -- granularidade de dias não exige mais que
// isso. Ver .github/workflows/campaign-followups.yml.
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const supabaseAdmin = createAdminClient();

  const { data: campaigns } = await supabaseAdmin
    .from("campaigns")
    .select("id, corpo_mensagem, modo_teste, campaign_followups(*)")
    .in("status", ["EM_EXECUCAO", "FINALIZADA"]);

  let disparados = 0;

  for (const campaign of campaigns ?? []) {
    const followups = (campaign.campaign_followups ?? []).sort(
      (a: { ordem: number }, b: { ordem: number }) => a.ordem - b.ordem
    );
    if (followups.length === 0) continue;

    const { data: enviados } = await supabaseAdmin
      .from("campaign_leads")
      .select(
        "id, lead_id, followups_enviados, ultimo_envio_em, leads(status, telefone, responsavel_id, empresa, cidade, nicho, rating_google, site, instagram)"
      )
      .eq("campaign_id", campaign.id)
      .eq("status", "ENVIADO");

    for (const cl of enviados ?? []) {
      const lead = cl.leads as unknown as {
        status: string;
        telefone: string;
        responsavel_id: string | null;
        empresa: string;
        cidade: string | null;
        nicho: string | null;
        rating_google: number | null;
        site: string | null;
        instagram: string | null;
      } | null;
      if (!lead || lead.status !== "NOVO" || !lead.responsavel_id || !cl.ultimo_envio_em) continue;

      const idx = cl.followups_enviados;
      if (idx >= followups.length) continue;
      const followup = followups[idx];

      const diasPassados = (Date.now() - new Date(cl.ultimo_envio_em).getTime()) / 86_400_000;
      if (diasPassados < followup.dias) continue;

      const { data: respondeu } = await supabaseAdmin
        .from("lead_events")
        .select("id")
        .eq("lead_id", cl.lead_id)
        .eq("type", "LEAD_REPLIED")
        .gte("created_at", cl.ultimo_envio_em)
        .limit(1);
      if (respondeu && respondeu.length > 0) continue;

      const { data: responsavel } = await supabaseAdmin
        .from("profiles")
        .select("full_name")
        .eq("id", lead.responsavel_id)
        .single();

      const texto = (followup.texto || "")
        .replaceAll("{empresa}", lead.empresa ?? "")
        .replaceAll("{responsavel}", responsavel?.full_name ?? "")
        .replaceAll("{cidade}", lead.cidade ?? "")
        .replaceAll("{nicho}", lead.nicho ?? "")
        .replaceAll("{rating}", lead.rating_google != null ? String(lead.rating_google) : "")
        .replaceAll("{site}", lead.site ?? "")
        .replaceAll("{instagram}", lead.instagram ?? "");

      if (!campaign.modo_teste) {
        if (!lead.telefone) continue;
        await supabaseAdmin.from("outbox_messages").insert({
          profile_id: lead.responsavel_id,
          lead_id: cl.lead_id,
          campaign_id: campaign.id,
          to_phone: lead.telefone,
          body: texto,
          not_before: new Date().toISOString(),
        });
      }

      await supabaseAdmin
        .from("campaign_leads")
        .update({
          followups_enviados: idx + 1,
          ultimo_envio_em: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", cl.id);

      disparados++;
    }
  }

  return NextResponse.json({ disparados });
}
