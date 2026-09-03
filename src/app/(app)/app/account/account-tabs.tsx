"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ACCOUNT_TABS, type AccountTabSlug } from "@/components/sidebar/nav-config";

// Feedback fix: account settings used to be real routes per tab
// (/app/account/profile, .../security, ...) — every switch paid for a
// full RSC round-trip. Same instant pattern as the project Paramètres
// hub now: all panels fetched and rendered once (account/page.tsx),
// switching between them is pure client state, URL kept in sync via
// history.replaceState (not router.replace, which would re-trigger the
// exact round-trip this avoids).
export function AccountTabsHub({
  initialTab,
  panels,
}: {
  initialTab: AccountTabSlug;
  panels: Record<AccountTabSlug, React.ReactNode>;
}) {
  const [tab, setTab] = useState<AccountTabSlug>(initialTab);

  function selectTab(value: AccountTabSlug) {
    if (value === tab) return;
    setTab(value);
    const url = value === "overview" ? "/app/account" : `/app/account?tab=${value}`;
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Feedback fix: this used to wrap onto a second, near-full-width row
          on narrow screens — a horizontally scrollable single row instead,
          same idea as the docs sidebar's mobile treatment. */}
      <div className="flex w-full items-center gap-1 overflow-x-auto rounded-full bg-muted p-1 sm:w-fit">
        {ACCOUNT_TABS.map((t) => (
          <button
            key={t.tab}
            type="button"
            onClick={() => selectTab(t.tab)}
            aria-current={tab === t.tab ? "true" : undefined}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-sm font-medium whitespace-nowrap transition-colors",
              tab === t.tab
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(Object.keys(panels) as AccountTabSlug[]).map((value) => (
        <div
          key={value}
          hidden={tab !== value}
          inert={tab !== value}
          className={
            tab === value
              ? "motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
              : undefined
          }
        >
          {panels[value]}
        </div>
      ))}
    </div>
  );
}
