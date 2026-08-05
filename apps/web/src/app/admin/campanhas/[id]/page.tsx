import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { CampaignDetailClient } from "./campaign-detail-client";

export default async function CampaignDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  let profile;
  try {
    profile = await requireAdmin();
  } catch {
    redirect("/");
  }

  const { id } = await params;

  return (
    <AppShell profile={profile}>
      <CampaignDetailClient campaignId={id} />
    </AppShell>
  );
}
