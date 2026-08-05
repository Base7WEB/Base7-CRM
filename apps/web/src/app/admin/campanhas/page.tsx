import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { CampanhasClient } from "./campanhas-client";

export default async function CampanhasPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/");
  }

  return <CampanhasClient />;
}
