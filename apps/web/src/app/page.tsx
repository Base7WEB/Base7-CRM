import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/auth";
import { signOut } from "@/app/login/actions";

export default async function HomePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-neutral-900">BASE7 CRM</h1>
          <p className="text-sm text-neutral-500">
            {profile.full_name} ·{" "}
            {profile.role === "ADMIN" ? "Administrador" : "Consultor comercial"}
          </p>
        </div>
        <form action={signOut}>
          <button
            type="submit"
            className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm text-neutral-700 hover:bg-neutral-50"
          >
            Sair
          </button>
        </form>
      </div>

      {profile.role === "ADMIN" && (
        <div className="mt-8 rounded-lg border border-neutral-200 p-4">
          <Link href="/admin/usuarios" className="text-sm font-medium text-neutral-900 underline">
            Gerenciar consultores
          </Link>
        </div>
      )}
    </div>
  );
}
