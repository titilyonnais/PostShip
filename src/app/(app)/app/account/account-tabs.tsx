"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { ACCOUNT_TABS } from "@/components/sidebar/nav-config";

// V1 (ia-moderne backlog): Compte/Facturation/Zone dangereuse moved out of
// the project sidebar into the footer user dropdown — this replaces the
// old drill-down pane as the way to reach the account section's own
// sub-pages (Profil, Sécurité, ...), same pill style as the Paramètres
// hub (settings/settings-tabs.tsx), but route-based since these are real
// distinct pages, not a single page keyed off ?tab=.
export function AccountTabs() {
  const pathname = usePathname();

  return (
    <div className="flex w-fit flex-wrap items-center gap-1 rounded-full bg-muted p-1">
      {ACCOUNT_TABS.map((tab) => {
        const isActive =
          tab.href === "/app/account"
            ? pathname === "/app/account"
            : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
