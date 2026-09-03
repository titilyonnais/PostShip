"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

export type SettingsTab = "general" | "rules" | "bot" | "team";

const TABS: { value: SettingsTab; label: string }[] = [
  { value: "general", label: "Général" },
  { value: "rules", label: "Règles" },
  { value: "bot", label: "Bot" },
  { value: "team", label: "Équipe" },
];

// S1 (site backlog): all 4 panels are fetched and rendered server-side in
// one request (see page.tsx) — switching tabs here is pure client state,
// no navigation, no new RSC round-trip. The URL is kept in sync via
// history.replaceState (not router.replace/push, which would re-trigger
// the exact server round-trip this is meant to avoid) so a deep link or a
// reload still lands on the right tab.
export function SettingsTabsHub({
  projectId,
  initialTab,
  isOwner,
  panels,
}: {
  projectId: string;
  initialTab: SettingsTab;
  isOwner: boolean;
  panels: Record<SettingsTab, React.ReactNode>;
}) {
  const [tab, setTab] = useState<SettingsTab>(initialTab);
  const tabs = isOwner ? TABS : TABS.filter((t) => t.value !== "team");

  function selectTab(value: SettingsTab) {
    if (value === tab) return;
    setTab(value);
    const url =
      value === "general"
        ? `/app/${projectId}/settings`
        : `/app/${projectId}/settings?tab=${value}`;
    window.history.replaceState(null, "", url);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex w-fit items-center gap-1 rounded-full bg-muted p-1">
        {tabs.map((t) => (
          <button
            key={t.value}
            type="button"
            onClick={() => selectTab(t.value)}
            aria-current={tab === t.value ? "true" : undefined}
            className={cn(
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              tab === t.value
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(Object.keys(panels) as SettingsTab[]).map((value) => (
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
