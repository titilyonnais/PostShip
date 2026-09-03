// V6 (ia-moderne backlog): "mutation radar" — uptime says 200, but the
// founder wants to know when the page's H1/title/meta description/
// og:title quietly disappears or turns into "Coming soon" after a
// deploy (price pulled, page half-reverted, etc). Extraction happens in
// src/lib/checks/http.ts (it already parses the HTML); this file holds
// only the deterministic, testable alert rule.
export type PageSurface = {
  title: string | null;
  h1: string | null;
  description: string | null;
  ogTitle: string | null;
};

const SURFACE_FIELDS: (keyof PageSurface)[] = ["title", "h1", "description", "ogTitle"];

// Suspicious placeholder text a field might have been replaced with —
// not just gone blank, but visibly broken/unfinished.
const SUSPICIOUS_PATTERN = /(coming soon|under construction|erreur|error 5\d\d)/i;

export type SurfaceMutation = {
  field: keyof PageSurface;
  before: string;
  after: string | null;
};

// A field only counts as mutated if it was non-empty before AND (now
// empty OR now matches the suspicious pattern) — an ordinary title typo
// (non-empty -> different non-empty, no suspicious match) is not a
// mutation.
export function detectSurfaceMutations(
  before: PageSurface | null,
  after: PageSurface,
): SurfaceMutation[] {
  if (!before) return [];

  const mutations: SurfaceMutation[] = [];
  for (const field of SURFACE_FIELDS) {
    const b = before[field];
    const a = after[field];
    if (!b || b === a) continue;

    const becameEmpty = !a;
    const becameSuspicious = !!a && SUSPICIOUS_PATTERN.test(a);
    if (becameEmpty || becameSuspicious) {
      mutations.push({ field, before: b, after: a });
    }
  }
  return mutations;
}

// Deploy-only, per the backlog: a cron tick or a manual "Lancer
// maintenant" run never alerts on a mutation, however dramatic.
export function shouldAlertMutated(
  before: PageSurface | null,
  after: PageSurface,
  isDeployRun: boolean,
): boolean {
  if (!isDeployRun) return false;
  return detectSurfaceMutations(before, after).length > 0;
}

const FIELD_LABEL: Record<keyof PageSurface, string> = {
  title: "Titre",
  h1: "H1",
  description: "Description",
  ogTitle: "OG title",
};

export function describeSurfaceMutation(mutation: SurfaceMutation): string {
  const after = mutation.after ? `« ${mutation.after} »` : "vide";
  return `${FIELD_LABEL[mutation.field]} : « ${mutation.before} » → ${after}`;
}
