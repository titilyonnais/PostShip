import Link from "next/link";
import { cn } from "@/lib/utils";

export type SettingsTab = "general" | "rules" | "bot" | "team";

const TABS: { value: SettingsTab; label: string }[] = [
  { value: "general", label: "Général" },
  { value: "rules", label: "Règles" },
  { value: "bot", label: "Bot" },
  { value: "team", label: "Équipe" },
];

// V2 (ia-moderne backlog): Vercel-style Settings hub — pill tabs over
// ?tab=, default "general". A plain Link row rather than the base-ui Tabs
// primitive: state lives in the URL (so a reload or a deep link lands on
// the right tab), which Link already gives for free.
export function SettingsTabs({
  projectId,
  active,
  isOwner,
}: {
  projectId: string;
  active: SettingsTab;
  isOwner: boolean;
}) {
  const tabs = isOwner ? TABS : TABS.filter((tab) => tab.value !== "team");

  return (
    <div className="flex w-fit items-center gap-1 rounded-full bg-muted p-1">
      {tabs.map((tab) => (
        <Link
          key={tab.value}
          href={
            tab.value === "general"
              ? `/app/${projectId}/settings`
              : `/app/${projectId}/settings?tab=${tab.value}`
          }
          className={cn(
            "rounded-full px-3 py-1 text-sm font-medium transition-colors",
            active === tab.value
              ? "bg-background text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
        </Link>
      ))}
    </div>
  );
}
