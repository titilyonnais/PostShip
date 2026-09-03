import { notFound } from "next/navigation";
import {
  getAuthUser,
  getProject,
  getProjectMembers,
  getProjectOwnerPlan,
} from "@/lib/db/loaders";
import { BotTab } from "./bot-tab";
import { GeneralTab } from "./general-tab";
import { RulesTab } from "./rules-tab";
import { SettingsTabsHub, type SettingsTab } from "./settings-tabs";
import { TeamTab } from "./team-tab";

export const metadata = {
  title: "Paramètres du projet",
};

const VALID_TABS: SettingsTab[] = ["general", "rules", "bot", "team"];

function parseTab(raw: string | undefined): SettingsTab {
  return VALID_TABS.includes(raw as SettingsTab) ? (raw as SettingsTab) : "general";
}

// V2 (ia-moderne backlog): /app/[projectId]/settings is now a hub with
// pill tabs (?tab=general|rules|bot|team, default general) — Vercel
// Settings' pattern. Règles and Bot used to be their own sidebar items
// and pages; those routes now redirect here (see ../rules/page.tsx and
// ../bot/page.tsx).
export default async function ProjectSettingsPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { projectId } = await params;
  const { tab: rawTab } = await searchParams;
  let tab = parseTab(rawTab);

  const [project, user] = await Promise.all([getProject(projectId), getAuthUser()]);
  if (!project) notFound();

  const isOwner = user?.id === project.user_id;
  // Équipe is owner-only (see SettingsTabs) — a collaborator hitting
  // ?tab=team directly falls back to Général rather than a blank tab.
  if (tab === "team" && !isOwner) tab = "general";

  const [ownerPlan, members] = await Promise.all([
    getProjectOwnerPlan(project.user_id),
    isOwner ? getProjectMembers(projectId) : Promise.resolve([]),
  ]);

  return (
    <SettingsTabsHub
      projectId={projectId}
      initialTab={tab}
      isOwner={isOwner}
      panels={{
        general: <GeneralTab projectId={projectId} project={project} isOwner={isOwner} />,
        rules: <RulesTab projectId={projectId} project={project} ownerPlan={ownerPlan} />,
        bot: <BotTab projectId={projectId} project={project} ownerPlan={ownerPlan} />,
        team: isOwner ? (
          <TeamTab projectId={projectId} members={members} ownerPlan={ownerPlan} />
        ) : null,
      }}
    />
  );
}
