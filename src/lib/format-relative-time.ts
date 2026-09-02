const RTF = new Intl.RelativeTimeFormat("fr", { numeric: "auto" });

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 365 * 24 * 60 * 60 * 1000],
  ["month", 30 * 24 * 60 * 60 * 1000],
  ["day", 24 * 60 * 60 * 1000],
  ["hour", 60 * 60 * 1000],
  ["minute", 60 * 1000],
];

// Server-rendered, so this is a snapshot as of request time — accurate
// enough for "when did the runner last touch this project," not meant to
// tick live in the browser.
export function formatRelativeTime(iso: string): string {
  const diffMs = new Date(iso).getTime() - Date.now();
  const absMs = Math.abs(diffMs);

  if (absMs < 60_000) return "à l'instant";

  for (const [unit, unitMs] of UNITS) {
    if (absMs >= unitMs) {
      return RTF.format(Math.round(diffMs / unitMs), unit);
    }
  }

  return RTF.format(Math.round(diffMs / 1000), "second");
}
