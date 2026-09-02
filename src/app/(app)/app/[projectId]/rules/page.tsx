import Link from "next/link";
import { notFound } from "next/navigation";
import { BellOff, ListChecks } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { getProject, getProjectOwnerPlan } from "@/lib/db/loaders";
import { getPlanLimits } from "@/lib/entitlements";
import { createClient } from "@/lib/db/server";
import { setAlertConfirmCount, setQuietHours, silenceTarget } from "../actions";
import { ConfirmCountSelect } from "./confirm-count-select";
import { QuietHourSelect } from "./quiet-hour-select";

export const metadata = {
  title: "Règles d'alerte",
};

export default async function RulesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProject(projectId);
  if (!project) notFound();

  const ownerPlan = await getProjectOwnerPlan(project.user_id);
  // Same Solo+ availability as chat webhooks (see assertRulesAllowed in
  // ../actions.ts) — no separate entitlement flag for this.
  const allowed = getPlanLimits(ownerPlan).chatWebhooks;
  const backTo = `/app/${projectId}/rules`;

  const supabase = await createClient();
  const { data: silencedTargets } = await supabase
    .from("check_targets")
    .select("id, url, silenced_until")
    .eq("project_id", projectId)
    .not("silenced_until", "is", null)
    .gt("silenced_until", new Date().toISOString())
    .order("silenced_until");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <ListChecks className="size-3.5" aria-hidden="true" />
          Confirmation avant alerte
        </h2>
        {!allowed && (
          <p className="text-xs text-muted-foreground">
            Disponible à partir du plan Solo.{" "}
            <Link
              href={`/app/billing?from=${encodeURIComponent(backTo)}`}
              className="text-foreground underline underline-offset-2"
            >
              Passer à Solo/Pro
            </Link>
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Attendre plusieurs échecs consécutifs avant d&apos;alerter réduit
          les faux positifs sur un réseau instable, au prix d&apos;un délai
          de détection plus long.
        </p>
        <fieldset disabled={!allowed}>
          <ActionForm
            action={setAlertConfirmCount.bind(null, projectId)}
            className="flex items-end gap-2"
          >
            <div className="flex flex-col gap-1">
              <label
                htmlFor="alert_confirm_count"
                className="text-xs text-muted-foreground"
              >
                Alerter après
              </label>
              <ConfirmCountSelect
                defaultValue={String(project.alert_confirm_count ?? 1)}
              />
            </div>
            <SubmitButton variant="outline" pendingText="...">
              Enregistrer
            </SubmitButton>
          </ActionForm>
        </fieldset>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <BellOff className="size-3.5" aria-hidden="true" />
          Heures calmes
        </h2>
        {!allowed && (
          <p className="text-xs text-muted-foreground">
            Disponible à partir du plan Solo.{" "}
            <Link
              href={`/app/billing?from=${encodeURIComponent(backTo)}`}
              className="text-foreground underline underline-offset-2"
            >
              Passer à Solo/Pro
            </Link>
          </p>
        )}
        <p className="text-xs text-muted-foreground">
          Aucune alerte sortante pendant cette plage — les vérifications
          continuent en arrière-plan. Fuseau fixé à Europe/Paris.
        </p>
        <fieldset disabled={!allowed}>
          <ActionForm
            action={setQuietHours.bind(null, projectId)}
            className="flex items-end gap-2"
          >
            <div className="flex flex-col gap-1">
              <label
                htmlFor="quiet_hours_start"
                className="text-xs text-muted-foreground"
              >
                De
              </label>
              <QuietHourSelect
                name="quiet_hours_start"
                defaultValue={
                  project.quiet_hours_start === null
                    ? ""
                    : String(project.quiet_hours_start)
                }
                label="Heure de début des heures calmes"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="quiet_hours_end"
                className="text-xs text-muted-foreground"
              >
                À
              </label>
              <QuietHourSelect
                name="quiet_hours_end"
                defaultValue={
                  project.quiet_hours_end === null
                    ? ""
                    : String(project.quiet_hours_end)
                }
                label="Heure de fin des heures calmes"
              />
            </div>
            <span className="pb-1.5 text-xs text-muted-foreground">
              Europe/Paris
            </span>
            <SubmitButton variant="outline" pendingText="...">
              Enregistrer
            </SubmitButton>
          </ActionForm>
        </fieldset>
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-border bg-card p-4">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          URLs actuellement silencieuses
        </h2>
        {silencedTargets && silencedTargets.length > 0 ? (
          <ul className="flex flex-col gap-1.5">
            {silencedTargets.map((target) => (
              <li
                key={target.id}
                className="flex items-center justify-between gap-2"
              >
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-muted-foreground">
                  {target.url}
                </span>
                <span className="shrink-0 text-[0.7rem] text-muted-foreground">
                  jusqu&apos;à{" "}
                  {new Date(target.silenced_until!).toLocaleString("fr-FR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
                <ActionForm
                  action={silenceTarget.bind(null, projectId, target.id, 0)}
                >
                  <SubmitButton
                    variant="ghost"
                    size="sm"
                    className="shrink-0 text-muted-foreground"
                    pendingText="..."
                  >
                    Reprendre
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">
            Aucune URL silencieuse.
          </p>
        )}
      </div>
    </div>
  );
}
