import { createServiceClient } from "@/lib/db/service";
import { getStripe } from "@/lib/stripe";

// Access is an env allowlist, not a column: a database flag needs a write
// path, and any write path to "is admin" is a privilege-escalation
// surface. ADMIN_USER_IDS can only be changed by whoever can already
// deploy.
export function isAdminUser(userId: string | null | undefined): boolean {
  if (!userId) return false;
  const raw = process.env.ADMIN_USER_IDS;
  if (!raw) return false;
  return raw
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean)
    .includes(userId);
}

export type OverviewSeriesPoint = {
  day: string;
  signups: number;
  active_users: number;
  check_runs: number;
  failed_runs: number;
};

export type AdminOverview = {
  generated_at: string;
  window_days: number;
  totals: {
    users: number;
    projects: number;
    targets: number;
    targets_enabled: number;
    incidents_open: number;
  };
  presence: {
    online_now: number;
    active_24h: number;
    active_7d: number;
    active_30d: number;
  };
  plans: Record<string, number>;
  checks_24h: { total: number; failed: number };
  last_check_run_at: string | null;
  last_deploy_event_at: string | null;
  series: OverviewSeriesPoint[];
  noisiest_projects: { id: string; name: string; failed: number }[];
};

export async function getAdminOverview(days: number): Promise<AdminOverview | null> {
  const { data, error } = await createServiceClient().rpc("admin_overview", { days });
  if (error) {
    console.error("Échec admin_overview", error.message);
    return null;
  }
  return data as AdminOverview;
}

export type StripeSnapshot = {
  /** Monthly recurring revenue in minor units. */
  mrr: number;
  currency: string;
  activeSubscriptions: number;
  pastDueSubscriptions: number;
  canceledThisMonth: number;
  /** Paid invoice totals per month, oldest first. */
  revenueByMonth: { month: string; amount: number }[];
  failedInvoices: { id: string; amount: number; created: number; customer: string | null }[];
  oneOffRevenue30d: number;
};

// Read live rather than mirrored: subscriptions change on Stripe's
// schedule (retries, proration, dunning), and a stale copy of revenue is
// worse than none.
export async function getStripeSnapshot(): Promise<StripeSnapshot | null> {
  if (!process.env.STRIPE_SECRET_KEY) return null;

  try {
    const stripe = getStripe();
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const [subs, invoices] = await Promise.all([
      stripe.subscriptions.list({ status: "all", limit: 100 }),
      // 12 months of invoices is enough for the revenue chart and cheap
      // enough to pull in one page-load.
      stripe.invoices.list({ limit: 100 }),
    ]);

    let mrr = 0;
    let currency = "eur";
    let activeSubscriptions = 0;
    let pastDueSubscriptions = 0;
    let canceledThisMonth = 0;

    for (const sub of subs.data) {
      if (sub.status === "active" || sub.status === "trialing") {
        activeSubscriptions += 1;
        for (const item of sub.items.data) {
          const price = item.price;
          const unit = price.unit_amount ?? 0;
          const qty = item.quantity ?? 1;
          const interval = price.recurring?.interval;
          // Normalise to a month so a yearly plan doesn't read as a
          // twelve-fold spike in a "monthly recurring" number.
          const monthly =
            interval === "year"
              ? unit / 12
              : interval === "week"
                ? unit * 4.345
                : interval === "day"
                  ? unit * 30.44
                  : unit;
          mrr += monthly * qty;
          currency = price.currency ?? currency;
        }
      }
      if (sub.status === "past_due" || sub.status === "unpaid") pastDueSubscriptions += 1;
      if (sub.canceled_at && sub.canceled_at * 1000 >= monthStart.getTime()) {
        canceledThisMonth += 1;
      }
    }

    const byMonth = new Map<string, number>();
    const failedInvoices: StripeSnapshot["failedInvoices"] = [];
    let oneOffRevenue30d = 0;
    const thirtyDaysAgo = Date.now() / 1000 - 30 * 24 * 60 * 60;

    for (const invoice of invoices.data) {
      if (invoice.amount_paid > 0) {
        const month = new Date(invoice.created * 1000).toISOString().slice(0, 7);
        byMonth.set(month, (byMonth.get(month) ?? 0) + invoice.amount_paid);
        // No subscription on the invoice means a token pack, not a plan.
        const isSubscription = Boolean(
          (invoice as unknown as { subscription?: string | null }).subscription,
        );
        if (!isSubscription && invoice.created >= thirtyDaysAgo) {
          oneOffRevenue30d += invoice.amount_paid;
        }
      }
      if (invoice.status === "open" && (invoice.attempt_count ?? 0) > 0) {
        failedInvoices.push({
          id: invoice.id ?? "",
          amount: invoice.amount_due,
          created: invoice.created,
          customer:
            typeof invoice.customer === "string"
              ? invoice.customer
              : (invoice.customer?.id ?? null),
        });
      }
    }

    return {
      mrr: Math.round(mrr),
      currency,
      activeSubscriptions,
      pastDueSubscriptions,
      canceledThisMonth,
      revenueByMonth: [...byMonth.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([month, amount]) => ({ month, amount })),
      failedInvoices: failedInvoices.slice(0, 10),
      oneOffRevenue30d,
    };
  } catch (err) {
    console.error("Échec lecture Stripe (admin)", err);
    return null;
  }
}
