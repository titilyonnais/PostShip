// Deterministic, template-based alert copy — zero LLM (CLAUDE.md / features
// backlog F4). Every rule here is a plain string match against `missing`
// codes already produced by the checks (http.ts, assets.ts, og.ts).

export type AlertCopyItem = {
  url: string;
  kind: "fail" | "recovered" | "mutated";
  outcome: string;
  httpStatus: number | null;
  missing?: string[] | null;
  ttfbMs?: number | null;
  deployHint?: string | null;
  // V6 (ia-moderne backlog): a human-readable "field: before → after"
  // line for a "mutated" item — describeAlertItem falls back to a plain
  // sentence if unset.
  mutationSummary?: string | null;
};

export type AlertCopy = {
  subject: string;
  text: string;
  discordDescription: string;
  slackText: string;
};

export function describeAlertItem(item: AlertCopyItem): string {
  if (item.kind === "recovered") {
    return `Rétabli — ${item.url}`;
  }

  if (item.kind === "mutated") {
    return item.mutationSummary
      ? `${item.url} — ${item.mutationSummary}`
      : `Contenu modifié après déploiement sur ${item.url}.`;
  }

  const missing = item.missing ?? [];

  const assetMissing = missing.find((m) => m.startsWith("asset:"));
  if (assetMissing) {
    const path = assetMissing.split(":").slice(2).join(":");
    return `La page répond 200 mais un fichier statique est introuvable : ${path}.`;
  }
  if (missing.includes("stripe_js")) {
    return `Stripe.js n'est plus chargé sur ${item.url}.`;
  }
  if (missing.includes("login_form")) {
    return `Le formulaire de connexion est introuvable sur ${item.url}.`;
  }
  if (missing.includes("price_token")) {
    return `Le prix n'apparaît plus sur ${item.url}.`;
  }
  if (missing.some((m) => m === "og:image" || m.includes("reachable"))) {
    return `La carte sociale n'a plus d'image valide.`;
  }

  return `${item.url} répond ${item.httpStatus ?? "—"}.`;
}

// Same rules as describeAlertItem, minus the URL — the email card already
// prints it on its own line directly above, so repeating it there reads as
// noise ("https://x" followed by "https://x répond 404."). Returns null when
// the only thing left to say is the HTTP status, which the card's own
// "HTTP 404 · TTFB 115 ms" line already carries.
export function describeAlertItemShort(item: AlertCopyItem): string | null {
  if (item.kind === "recovered") return null;

  if (item.kind === "mutated") {
    return item.mutationSummary ?? "Contenu modifié après déploiement.";
  }

  const missing = item.missing ?? [];

  const assetMissing = missing.find((m) => m.startsWith("asset:"));
  if (assetMissing) {
    const path = assetMissing.split(":").slice(2).join(":");
    return `La page répond 200 mais un fichier statique est introuvable : ${path}.`;
  }
  if (missing.includes("stripe_js")) {
    return "Stripe.js n'est plus chargé.";
  }
  if (missing.includes("login_form")) {
    return "Le formulaire de connexion est introuvable.";
  }
  if (missing.includes("price_token")) {
    return "Le prix n'apparaît plus.";
  }
  if (missing.some((m) => m === "og:image" || m.includes("reachable"))) {
    return "La carte sociale n'a plus d'image valide.";
  }

  return null;
}

export function buildAlertCopy(
  projectName: string,
  items: AlertCopyItem[],
): AlertCopy {
  const nFail = items.filter((i) => i.kind === "fail").length;
  const nRecovered = items.filter((i) => i.kind === "recovered").length;
  const nMutated = items.filter((i) => i.kind === "mutated").length;
  const hasFail = nFail > 0;

  const deployHint = items.find((i) => i.deployHint)?.deployHint ?? null;
  const recap =
    `${nFail} en échec, ${nRecovered} rétablis.` +
    (nMutated > 0 ? ` ${nMutated} modification(s) de contenu.` : "");
  const recapLine = deployHint
    ? `Depuis le dernier déploiement : ${recap}`
    : recap;

  const lines = items.map(describeAlertItem);

  const subject = `[PostShip] ${projectName} — ${
    hasFail
      ? `${nFail} URL(s) en échec`
      : nRecovered > 0
        ? `${nRecovered} URL(s) rétabli`
        : `${nMutated} URL(s) modifiée(s)`
  }`;

  const text = [recapLine, ...lines].join("\n");

  const discordDescription = [
    recapLine,
    ...items.map(
      (item) =>
        `${item.kind === "recovered" ? "✅" : item.kind === "mutated" ? "🟠" : "🔴"} ${describeAlertItem(item)}`,
    ),
  ].join("\n");

  const slackText = [
    recapLine,
    ...items.map(
      (item) =>
        `${item.kind === "recovered" ? ":large_green_circle:" : item.kind === "mutated" ? ":large_orange_circle:" : ":red_circle:"} ${describeAlertItem(item)}`,
    ),
  ].join("\n");

  return { subject, text, discordDescription, slackText };
}
