import type Stripe from "stripe";
import { recordOpsEvent, type OpsSeverity, type OpsSource } from "@/lib/ops-events";

// Maps a Stripe event onto the journal. One row per verified webhook, so
// the log answers "what did Stripe tell us, and when" without anyone
// having to open the Stripe dashboard and correlate by hand.
//
// Severity is the point of this file. Everything Stripe sends is "info" to
// Stripe; what matters here is which ones need a human.
const SEVERITY: Record<string, OpsSeverity> = {
  "charge.dispute.created": "fraud",
  "charge.dispute.closed": "fraud",
  "radar.early_fraud_warning.created": "fraud",
  "invoice.payment_failed": "warn",
  "customer.subscription.past_due": "warn",
  "charge.failed": "warn",
  "charge.refunded": "warn",
  "customer.subscription.deleted": "warn",
};

// Subscription and checkout events describe the billing relationship
// rather than a payment, which is worth being able to filter apart.
const BILLING_PREFIXES = ["customer.subscription.", "checkout.session."];

function amountOf(object: Record<string, unknown>): number | null {
  for (const key of ["amount", "amount_due", "amount_paid", "amount_total"]) {
    const value = object[key];
    if (typeof value === "number") return value;
  }
  return null;
}

function customerOf(object: Record<string, unknown>): string | null {
  const customer = object.customer;
  if (typeof customer === "string") return customer;
  if (customer && typeof customer === "object" && "id" in customer) {
    return String((customer as { id: unknown }).id);
  }
  return null;
}

export async function recordStripeEvent(event: Stripe.Event): Promise<void> {
  const object = event.data.object as unknown as Record<string, unknown>;
  const source: OpsSource = BILLING_PREFIXES.some((p) => event.type.startsWith(p))
    ? "billing"
    : "stripe";

  await recordOpsEvent({
    source,
    severity: SEVERITY[event.type] ?? "info",
    action: `stripe.${event.type}`,
    target: customerOf(object),
    payload: {
      event_id: event.id,
      type: event.type,
      amount: amountOf(object),
      currency: typeof object.currency === "string" ? object.currency : null,
      status: typeof object.status === "string" ? object.status : null,
      // Enough to click straight through to the object in Stripe without
      // storing the whole payload, which can run to tens of kilobytes.
      object_id: typeof object.id === "string" ? object.id : null,
      livemode: event.livemode,
    },
  });
}
