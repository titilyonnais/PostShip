import { getStripe } from "@/lib/stripe";

// The billing tab used to hold nothing but an address form: every question
// a customer actually asks — what did I pay, when, did that payment go
// through, where is the receipt — meant leaving for the Stripe portal.
// Stripe stays the source of truth; this only reads it.

export type InvoiceRow = {
  id: string;
  number: string | null;
  created: number;
  /** Minor units, as Stripe returns them. */
  amount: number;
  currency: string;
  status: "paid" | "open" | "failed" | "void" | "draft" | "uncollectible";
  hostedUrl: string | null;
  pdfUrl: string | null;
  /** Set when Stripe will retry a failed payment on its own. */
  nextAttempt: number | null;
  description: string | null;
};

export type BillingHistory = {
  invoices: InvoiceRow[];
  /** Renewal date of the live subscription, if there is one. */
  renewsAt: number | null;
  cancelAtPeriodEnd: boolean;
  /** True when at least one invoice needs the customer to act. */
  hasActionNeeded: boolean;
};

// A failed charge leaves the invoice "open" with attempts on it, which is
// indistinguishable from "not due yet" unless you look — so it gets its
// own status here rather than being flattened into "open".
function classify(invoice: {
  status: string | null;
  attempt_count?: number | null;
  paid?: boolean;
}): InvoiceRow["status"] {
  if (invoice.status === "paid" || invoice.paid) return "paid";
  if (invoice.status === "void") return "void";
  if (invoice.status === "draft") return "draft";
  if (invoice.status === "uncollectible") return "uncollectible";
  if (invoice.status === "open" && (invoice.attempt_count ?? 0) > 0) return "failed";
  return "open";
}

export async function getBillingHistory(
  customerId: string | null,
): Promise<BillingHistory | null> {
  if (!customerId) return null;

  const stripe = getStripe();

  try {
    const [invoiceList, subscriptions] = await Promise.all([
      stripe.invoices.list({ customer: customerId, limit: 24 }),
      stripe.subscriptions.list({ customer: customerId, status: "all", limit: 1 }),
    ]);

    const invoices: InvoiceRow[] = invoiceList.data.map((invoice) => ({
      id: invoice.id ?? "",
      number: invoice.number ?? null,
      created: invoice.created,
      // amount_due on an unpaid invoice, amount_paid once settled — using
      // one field for both would show 0 for everything still outstanding.
      amount: invoice.amount_paid > 0 ? invoice.amount_paid : invoice.amount_due,
      currency: invoice.currency,
      status: classify(invoice),
      hostedUrl: invoice.hosted_invoice_url ?? null,
      pdfUrl: invoice.invoice_pdf ?? null,
      nextAttempt: invoice.next_payment_attempt ?? null,
      description:
        invoice.lines?.data?.[0]?.description ?? invoice.description ?? null,
    }));

    const subscription = subscriptions.data[0];
    // The period lives on the subscription item in current API versions;
    // the top-level field is kept as a fallback for older ones.
    const renewsAt =
      (subscription?.items?.data?.[0] as { current_period_end?: number } | undefined)
        ?.current_period_end ??
      (subscription as unknown as { current_period_end?: number } | undefined)
        ?.current_period_end ??
      null;

    return {
      invoices,
      renewsAt: renewsAt ?? null,
      cancelAtPeriodEnd: Boolean(subscription?.cancel_at_period_end),
      hasActionNeeded: invoices.some((i) => i.status === "failed" || i.status === "open"),
    };
  } catch (err) {
    // Never let a Stripe outage take the settings page down with it.
    console.error("Échec lecture de l'historique de facturation", err);
    return null;
  }
}

export function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}
