import { permanentRedirect } from "next/navigation";

// V2 (ia-moderne backlog): Bot moved from its own sidebar item/page into
// a Paramètres tab — this route stays valid, permanently redirecting.
export default async function BotRedirectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  permanentRedirect(`/app/${projectId}/settings?tab=bot`);
}
