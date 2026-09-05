// Shared between the in-app FailureDetails component and the alert email
// builder (src/lib/alerts.ts) — both need to turn a raw "missing" code
// from a check run into the same human-readable French sentence, so it's
// pulled out once here instead of drifting between two copies.
export const MISSING_LABELS: Record<string, string> = {
  expect_contains: "Le contenu attendu est absent de la réponse.",
  expect_not_contains: "Un contenu interdit est présent dans la réponse.",
  json_ld_syntax_error: "Le JSON-LD contient une erreur de syntaxe.",
  html_unparsable: "Le HTML retourné est illisible.",
  ssl_expiring_30d: "Le certificat SSL expire dans moins de 30 jours.",
  ssl_expiring_7d: "Le certificat SSL expire dans moins de 7 jours.",
  ssl_expiring_1d: "Le certificat SSL expire dans moins de 24h.",
  ssl_expired: "Le certificat SSL a expiré.",
  "og:title": "Le titre (og:title) est absent.",
  "og:title_too_long": "Le titre (og:title) dépasse 70 caractères.",
  "og:description": "La description (og:description) est absente.",
  "og:image": "L'image de partage (og:image) est absente.",
  "og:image reachable": "L'image de partage (og:image) n'est pas accessible.",
  "og:image_type": "Le format de l'image de partage n'est pas supporté.",
  "og:image_too_heavy": "L'image de partage dépasse 8 Mo.",
  "twitter:card": "La balise twitter:card est absente.",
  stripe_js: "Stripe.js n'est plus chargé sur cette page.",
  login_form: "Le formulaire de connexion est introuvable sur cette page.",
  price_token: "Le prix n'apparaît plus sur cette page.",
};

// asset:{status}:{path} codes carry a variable path, so they can't be a
// plain MISSING_LABELS lookup like the fixed codes above.
export function describeMissingCode(code: string): string {
  if (code.startsWith("asset:")) {
    const [, status, ...pathParts] = code.split(":");
    const path = pathParts.join(":");
    return `Fichier statique introuvable (${status}) : ${path}`;
  }
  return MISSING_LABELS[code] ?? code;
}

// The check type of a target (check_targets.kind). Shared between the
// TargetKindBadge component and the Discord/Slack payload builders, which
// can't import the component (it pulls lucide-react into server code).
export const CHECK_KIND_LABEL: Record<string, string> = {
  http: "HTTP",
  og: "OG / Twitter",
  sitemap: "Sitemap",
  ssl: "SSL",
  stripe_health: "Stripe health",
};
