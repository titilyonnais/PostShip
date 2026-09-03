import { permanentRedirect } from "next/navigation";

// V2 (ia-moderne backlog): Règles moved from its own sidebar item/page
// into a Paramètres tab — this route stays valid, permanently redirecting
// so no old link (bookmarks, the bot's own /rules mention, docs) breaks.
export default async function RulesRedirectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  permanentRedirect(`/app/${projectId}/settings?tab=rules`);
}
