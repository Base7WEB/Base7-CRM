import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const envPath = path.join(__dirname, "..", "apps", "web", ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf-8")
    .split("\n")
    .filter((line) => line.includes("="))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const email = process.argv[2];
const fullName = process.argv[3] ?? email;
const siteUrl = process.argv[4] ?? env.NEXT_PUBLIC_SITE_URL;

if (!email) {
  console.error("uso: node scripts/bootstrap-admin.mjs <email> [nome]");
  process.exit(1);
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, {
  data: { full_name: fullName, role: "ADMIN" },
  redirectTo: `${siteUrl}/auth/set-password`,
});

if (error) {
  console.error("Erro ao convidar admin:", error.message);
  process.exit(1);
}

console.log("Convite enviado para", email, "- user id:", data.user.id);
