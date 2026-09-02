import { notFound } from "next/navigation";
import { PauseCircle, Play } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Badge } from "@/components/ui/badge";
import { LastChecked } from "@/components/last-checked";
import { SubmitButton } from "@/components/submit-button";
import { getProject, getProjectOwnerPlan } from "@/lib/db/loaders";
import { getPlanLimits } from "@/lib/entitlements";
import { runProjectNow } from "./actions";

export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProject(projectId);

  if (!project) notFound();

  // The project's OWNER's plan, not the current viewer's — see the
  // comment on getProjectOwnerPlan.
  const intervalMinutes = getPlanLimits(
    await getProjectOwnerPlan(project.user_id),
  ).intervalMinutes;

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-semibold">{project.name}</h1>
            {project.paused && (
              <Badge variant="outline" className="gap-1 text-amber-600 dark:text-amber-400">
                <PauseCircle className="size-3" aria-hidden="true" />
                En pause
              </Badge>
            )}
          </div>
          <p className="font-mono text-sm text-muted-foreground">
            {project.base_url}
          </p>
          <LastChecked
            lastCheckedAt={project.last_checked_at}
            paused={project.paused}
            intervalMinutes={intervalMinutes}
          />
        </div>
        <div className="shrink-0">
          <ActionForm action={runProjectNow.bind(null, project.id)}>
            <SubmitButton pendingText="Vérification en cours...">
              <Play className="size-3.5" aria-hidden="true" />
              Lancer maintenant
            </SubmitButton>
          </ActionForm>
        </div>
      </div>

      {children}
    </div>
  );
}
