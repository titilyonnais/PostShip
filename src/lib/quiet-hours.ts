// D6 (drill-nav backlog): a project can define a daily quiet window
// (e.g. 22:00-08:00) during which outbound alerts are suppressed —
// check_runs keep being written, only the email/Discord/Slack/Telegram/
// webhook calls in dispatchAlerts are skipped (see src/lib/alerts.ts).
export function isInQuietHours(
  now: Date,
  start: number | null,
  end: number | null,
  tz: string,
): boolean {
  if (start === null || end === null) return false;

  const hourInTz = Number(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hour: "numeric",
      hour12: false,
    }).format(now),
  );
  // Intl can format midnight as "24" depending on the runtime's ICU data.
  const hour = hourInTz % 24;

  if (start === end) return false;

  // A window that crosses midnight (e.g. 22 -> 8) is "outside [end, start)"
  // rather than "inside [start, end)".
  if (start > end) return hour >= start || hour < end;
  return hour >= start && hour < end;
}
