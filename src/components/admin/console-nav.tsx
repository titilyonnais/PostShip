"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/users", label: "Utilisateurs" },
  { href: "/admin/projects", label: "Projets" },
  { href: "/admin/revenue", label: "Revenu" },
  { href: "/admin/vercel", label: "Vercel" },
  { href: "/admin/supabase", label: "Supabase" },
  { href: "/admin/logs", label: "Journal" },
  { href: "/admin/system", label: "Système" },
  { href: "/admin/security", label: "Sécurité" },
];

export function ConsoleNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-1">
      {NAV.map((item) => {
        // Exact match for the root, prefix for the rest — otherwise
        // "/admin" would light up on every page, since every path starts
        // with it.
        const active =
          item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`border-b px-2 py-1 font-mono text-xs transition-colors ${
              active
                ? "border-[#3fb950] text-neutral-100"
                : "border-transparent text-neutral-500 hover:text-neutral-200"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
