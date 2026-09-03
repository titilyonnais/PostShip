import Link from "next/link";
import { BellOff, ListChecks } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { createClient } from "@/lib/db/server";
import { getViewerTimezone } from "@/lib/db/loaders";
import { formatDateTime } from "@/lib/timezone";
import { setAlertConfirmCount, setQuietHours, silenceTarget } from "../actions";
import { ConfirmCountSelect } from "./confirm-count-select";
import { QuietHourSelect } from "./quiet-hour-select";

// V2 (ia-moderne backlog): moved from /rules (now a redirect to
// settings?tab=rules) — same content, same data, now one tab among
// several instead of its own sidebar item.
export async function RulesTab({
  projectId,
  project,
  ownerPlan,
}: {
  projectId: string;
  project: { alert_confirm_count: number | null; quiet_hours_start: number | null; quiet_hours_end: number | null };
  ownerPlan: Plan;
}) {
  const allowed = getPlanLimits(ownerPlan).chatWebhooks;
  const backTo = `/app/${projectId}/settings?tab=rules`;
  const timezone = await getViewerTimezone();

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
      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <ListChecks className="size-3.5 text-brand-2" aria-hidden="true" />
          Confirmation avant alerte
        </h2>
        {!allowed && (
          <p className="text-xs text-muted-foreground">
            Disponible à partir du plan Solo.{" "}
            <Link
              href={`/app/billing?from=${encodeURIComponent(backTo)}`}
              className="text-foreground underline underline-offset-2"
            >
              Passer à Solo
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

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
        <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          <BellOff className="size-3.5 text-brand-2" aria-hidden="true" />
          Heures calmes
        </h2>
        {!allowed && (
          <p className="text-xs text-muted-foreground">
            Disponible à partir du plan Solo.{" "}
            <Link
              href={`/app/billing?from=${encodeURIComponent(backTo)}`}
              className="text-foreground underline underline-offset-2"
            >
              Passer à Solo
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

      <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4">
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
                  {formatDateTime(target.silenced_until!, timezone, {
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
