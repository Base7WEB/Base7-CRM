import type { Profile } from "@/lib/auth";
import { Sidebar } from "./sidebar";

export function AppShell({ profile, children }: { profile: Profile; children: React.ReactNode }) {
  return (
    <>
      <Sidebar profile={profile} />
      <div className="watermark" />
      <main className="main">{children}</main>
    </>
  );
}
