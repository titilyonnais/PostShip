import { describeMissingCode } from "@/lib/check-labels";

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
    <div className="flex flex-col gap-1.5 rounded-2xl border border-destructive/30 bg-destructive/5 px-3 py-2.5 text-xs">
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
