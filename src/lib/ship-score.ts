// V7 (ia-moderne backlog): one number after each production deploy —
// posted to the GitHub Check and shown on Aperçu, instead of a bare
// pass/fail. Deterministic, no LLM (CLAUDE.md's no-AI-aesthetic rule).
export type ShipScoreCheckResult = {
  kind: string;
  outcome: "pass" | "fail" | "error";
  // True only for an http target with money-path assertions configured
  // (requireStripeJs/requireEmailOrPasswordInput/requirePriceToken) —
  // see the addTarget/money-path.ts assertions shape.
  isMoneyPath: boolean;
  missing: string[] | null;
  sslDaysRemaining: number | null;
};

type Category = "moneyPath" | "asset" | "og" | "sslExpiring" | "other";

const CATEGORY_POINTS: Record<Category, number> = {
  moneyPath: 40,
  asset: 25,
  og: 15,
  sslExpiring: 10,
  other: 10,
};

const CATEGORY_LABEL: Record<Category, string> = {
  moneyPath: "page argent",
  asset: "asset manquant",
  og: "carte OG",
  sslExpiring: "SSL bientôt expiré",
  other: "URL en échec",
};

function categorize(result: ShipScoreCheckResult): Category | null {
  const failing = result.outcome !== "pass";

  if (failing && result.kind === "http" && result.isMoneyPath) return "moneyPath";
  if (failing && (result.missing ?? []).some((m) => m.startsWith("asset:"))) return "asset";
  if (failing && result.kind === "og") return "og";
  // Independent of outcome — a cert can be 10 days from expiring while
  // the ssl check itself still reports pass.
  if (result.kind === "ssl" && result.sslDaysRemaining != null && result.sslDaysRemaining < 14) {
    return "sslExpiring";
  }
  if (failing) return "other";
  return null;
}

export type ShipScore = {
  score: number;
  // A single "−N label" line for the top-deducting category, or null at
  // a perfect 100 — Aperçu's "1 ligne d'explication".
  reason: string | null;
};

export function computeShipScore(results: ShipScoreCheckResult[]): ShipScore {
  const pointsByCategory: Record<Category, number> = {
    moneyPath: 0,
    asset: 0,
    og: 0,
    sslExpiring: 0,
    other: 0,
  };

  for (const result of results) {
    const category = categorize(result);
    if (category) pointsByCategory[category] += CATEGORY_POINTS[category];
  }

  const totalDeducted = (Object.values(pointsByCategory) as number[]).reduce(
    (sum, points) => sum + points,
    0,
  );
  const score = Math.max(0, 100 - totalDeducted);

  const topCategory = (Object.keys(pointsByCategory) as Category[])
    .filter((category) => pointsByCategory[category] > 0)
    .sort((a, b) => pointsByCategory[b] - pointsByCategory[a])[0];

  const reason = topCategory
    ? `−${CATEGORY_POINTS[topCategory]} ${CATEGORY_LABEL[topCategory]}`
    : null;

  return { score, reason };
}
