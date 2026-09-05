import Link from "next/link";
import { Download, ExternalLink, TriangleAlert } from "lucide-react";
import { type Plan } from "@/lib/entitlements";
import { PLAN_LABEL } from "@/lib/pricing";
import { formatAmount, type BillingHistory } from "@/lib/billing-history";
import { formatDateTime } from "@/lib/timezone";

const STATUS: Record<
  string,
  { label: string; className: string }
> = {
  paid: { label: "Payée", className: "bg-[#3fb950]/15 text-[#3fb950]" },
  failed: { label: "Paiement échoué", className: "bg-destructive/15 text-destructive" },
  open: { label: "À régler", className: "bg-[#d29922]/15 text-[#d29922]" },
  draft: { label: "Brouillon", className: "bg-muted text-muted-foreground" },
  void: { label: "Annulée", className: "bg-muted text-muted-foreground" },
  uncollectible: { label: "Irrécouvrable", className: "bg-destructive/15 text-destructive" },
};

function shortDate(seconds: number, timezone: string | null): string {
  return formatDateTime(new Date(seconds * 1000), timezone, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function BillingTab({
  plan,
  history,
  timezone,
}: {
  plan: Plan;
  /** null when there is no Stripe customer yet, or Stripe didn't answer. */
  history: BillingHistory | null;
  timezone: string | null;
}) {
  const failed = history?.invoices.filter((i) => i.status === "failed") ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm">
            Plan actuel : <span className="font-medium">{PLAN_LABEL[plan]}</span>
          </p>
          {history?.renewsAt && (
            <p className="text-xs text-muted-foreground">
              {history.cancelAtPeriodEnd ? "Se termine le " : "Se renouvelle le "}
              {shortDate(history.renewsAt, timezone)}
            </p>
          )}
        </div>
        <Link
          href="/app/billing"
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Changer de plan
        </Link>
      </div>

      {/* A failed charge is the one thing on this page that needs the
          customer to do something, so it is said before the table rather
          than left as a red pill halfway down it. */}
      {failed.length > 0 && (
        <div className="flex items-start gap-2 rounded-2xl bg-destructive/10 px-4 py-3 text-xs text-destructive">
          <TriangleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>
            {failed.length === 1
              ? "Un paiement a échoué."
              : `${failed.length} paiements ont échoué.`}{" "}
            {failed[0].nextAttempt
              ? `Stripe réessaiera le ${shortDate(failed[0].nextAttempt, timezone)}.`
              : "Réglez la facture pour éviter la suspension du plan."}{" "}
            {failed[0].hostedUrl && (
              <a
                href={failed[0].hostedUrl}
                target="_blank"
                rel="noreferrer"
                className="underline underline-offset-2"
              >
                Régler maintenant
              </a>
            )}
          </span>
        </div>
      )}

      <div className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Factures
        </h2>

        {history === null ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Aucun historique — vous n&apos;avez pas encore effectué de paiement.
          </p>
        ) : history.invoices.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Aucune facture pour le moment.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {history.invoices.map((invoice) => {
              const status = STATUS[invoice.status] ?? STATUS.open;
              return (
                <li
                  key={invoice.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2 text-sm"
                >
                  <span className="flex min-w-0 flex-col">
                    <span className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">
                        {invoice.number ?? "—"}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[0.65rem] font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {shortDate(invoice.created, timezone)}
                      {invoice.description ? ` · ${invoice.description}` : ""}
                    </span>
                  </span>

                  <span className="flex shrink-0 items-center gap-3">
                    <span className="font-mono text-sm">
                      {formatAmount(invoice.amount, invoice.currency)}
                    </span>
                    {invoice.hostedUrl && (
                      <a
                        href={invoice.hostedUrl}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Voir la facture chez Stripe"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <ExternalLink className="size-3.5" aria-hidden="true" />
                      </a>
                    )}
                    {invoice.pdfUrl && (
                      <a
                        href={invoice.pdfUrl}
                        aria-label="Télécharger le PDF"
                        className="text-muted-foreground hover:text-foreground"
                      >
                        <Download className="size-3.5" aria-hidden="true" />
                      </a>
                    )}
                  </span>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-xs text-muted-foreground">
          L&apos;adresse de facturation se règle dans l&apos;onglet Profil.
        </p>
      </div>
    </div>
  );
}
