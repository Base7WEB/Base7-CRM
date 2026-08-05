import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { UsuariosClient } from "./usuarios-client";

export default async function UsuariosPage() {
  try {
    await requireAdmin();
  } catch {
    redirect("/");
  }

  return <UsuariosClient />;
}
