import { AlertTriangle, Clock } from "lucide-react";
import { formatRelativeTime } from "@/lib/format-relative-time";

// The whole point of PostShip is "we ping your site on a schedule" — a
// user has no other way to tell the cron is actually alive short of
// trusting a black box. Surface the last tick, and flag it plainly when
// it's stale enough that the schedule likely isn't running (paused
// projects are expected to go quiet, so they're exempt).
export function LastChecked({
  lastCheckedAt,
  paused,
  intervalMinutes,
}: {
  lastCheckedAt: string | null;
  paused: boolean;
  intervalMinutes: number;
}) {
  if (!lastCheckedAt) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Clock className="size-3" aria-hidden="true" />
        Pas encore vérifié
      </span>
    );
  }

  const overdueMs = intervalMinutes * 60_000 * 2;
  const isOverdue =
    !paused && Date.now() - new Date(lastCheckedAt).getTime() > overdueMs;

  if (isOverdue) {
    return (
      <span className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400">
        <AlertTriangle className="size-3" aria-hidden="true" />
        En retard — dernière vérif {formatRelativeTime(lastCheckedAt)}
      </span>
    );
  }

  return (
    <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <Clock className="size-3" aria-hidden="true" />
      Vérifié {formatRelativeTime(lastCheckedAt)}
    </span>
  );
}
