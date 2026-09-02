const MISSING_LABELS: Record<string, string> = {
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

export type BrokenAsset = {
  url: string;
  status: number | null;
  contentType: string | null;
};

export type CheckRunDetails = {
  missing?: string[];
  error?: string;
  bodyExcerpt?: string;
  bodyTruncated?: boolean;
  redirects?: number;
  daysRemaining?: number;
  ogImageStatus?: number | null;
  brokenAssets?: BrokenAsset[];
  ogTitle?: string | null;
  ogDescription?: string | null;
  ogImage?: string | null;
};

// asset:{status}:{path} codes carry a variable path, so they can't be a
// plain MISSING_LABELS lookup like the fixed codes above.
function describeMissingCode(code: string): string {
  if (code.startsWith("asset:")) {
    const [, status, ...pathParts] = code.split(":");
    const path = pathParts.join(":");
    return `Fichier statique introuvable (${status}) : ${path}`;
  }
  return MISSING_LABELS[code] ?? code;
}

export function FailureDetails({
  details,
  httpStatus,
  expectStatus,
}: {
  details: CheckRunDetails;
  httpStatus?: number | null;
  expectStatus?: number | null;
}) {
  const statusMismatch =
    expectStatus != null && httpStatus != null && httpStatus !== expectStatus;

  const hasContent =
    statusMismatch ||
    (details.missing && details.missing.length > 0) ||
    details.error ||
    details.daysRemaining != null ||
    details.bodyExcerpt;

  if (!hasContent) return null;

  return (
    <div className="flex flex-col gap-1.5 rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs">
      {statusMismatch && (
        <p className="text-destructive">
          Statut attendu <strong>{expectStatus}</strong>, reçu{" "}
          <strong>{httpStatus}</strong>.
        </p>
      )}
      {details.daysRemaining != null && (
        <p className="text-destructive">
          Certificat SSL expire dans{" "}
          <strong>{details.daysRemaining} jour(s)</strong>.
        </p>
      )}
      {details.missing?.map((code) => (
        <p key={code} className="text-destructive">
          {describeMissingCode(code)}
        </p>
      ))}
      {details.error && <p className="text-destructive">{details.error}</p>}
      {details.bodyExcerpt && (
        <details className="text-muted-foreground">
          <summary className="cursor-pointer select-none text-foreground/70 hover:text-foreground">
            Voir la réponse brute
            {details.bodyTruncated ? " (tronquée)" : ""}
          </summary>
          <pre className="mt-1.5 overflow-x-auto whitespace-pre-wrap rounded-sm bg-secondary p-2">
            {details.bodyExcerpt}
          </pre>
        </details>
      )}
    </div>
  );
}
