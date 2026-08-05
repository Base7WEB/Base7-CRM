"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/login/actions";
import type { Profile } from "@/lib/auth";

const NAV_ADMIN = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/leads", label: "Leads", icon: "🧾" },
  { href: "/conversas", label: "Conversas", icon: "💬" },
  { href: "/admin/campanhas", label: "Campanhas", icon: "📣" },
  { href: "/admin/usuarios", label: "Consultores", icon: "👥" },
  { href: "/admin/configuracoes", label: "Notificações", icon: "🔔" },
  { href: "/admin/auditoria", label: "Auditoria", icon: "🗂️" },
];

const NAV_CONSULTOR = [
  { href: "/", label: "Dashboard", icon: "📊" },
  { href: "/leads", label: "Meus leads", icon: "🧾" },
  { href: "/conversas", label: "Conversas", icon: "💬" },
];

export function Sidebar({ profile }: { profile: Profile }) {
  const pathname = usePathname();
  const items = profile.role === "ADMIN" ? NAV_ADMIN : NAV_CONSULTOR;

  return (
    <aside className="sidebar">
      <div className="sidebar-logo-wrap">
        <Image src="/logo.png" alt="Base7 Web" width={929} height={409} className="sidebar-logo-img" priority />
        <p className="sidebar-tagline">CRM</p>
      </div>

      <nav className="menu">
        {items.map((item) => {
          const ativo = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link key={item.href} href={item.href} className={`menu-btn ${ativo ? "ativo" : ""}`}>
              <span aria-hidden>{item.icon}</span>
              <span className="menu-label">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className="sidebar-footer flex-col items-stretch gap-2">
        <div className="flex items-center gap-2">
          <span className="status-dot online" />
          <span className="status-txt truncate">
            {profile.full_name} · {profile.role === "ADMIN" ? "Admin" : "Consultor"}
          </span>
        </div>
        <form action={signOut}>
          <button type="submit" className="btn-outline btn-sm w-full justify-center">
            Sair
          </button>
        </form>
      </div>
    </aside>
  );
}
