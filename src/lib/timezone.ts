// profiles.timezone holds an IANA zone name (e.g. "Europe/Paris"), or null
// until TimezoneCapture records the browser's own zone on first load. Every
// absolute-time display in the app should go through formatDateTime rather
// than a raw toLocaleString — the latter renders in the server's zone,
// which is wrong for anyone not on that same clock.
export const DEFAULT_TIMEZONE = "Europe/Paris";

export function isValidTimezone(value: string): boolean {
  try {
    new Intl.DateTimeFormat("fr-FR", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

export function formatDateTime(
  value: string | Date,
  timezone: string | null | undefined,
  options: Intl.DateTimeFormatOptions,
): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("fr-FR", {
    timeZone: timezone || DEFAULT_TIMEZONE,
    ...options,
  }).format(date);
}
