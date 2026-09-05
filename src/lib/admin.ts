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

export type AdminUserRow = {
  id: string;
  email: string | null;
  username: string | null;
  plan: string | null;
  token_balance: number | null;
  stripe_subscription_status: string | null;
  created_at: string;
  projects: number;
  targets: number;
  last_seen_at: string | null;
  /** From the nightly sweep. Null until an account has been scored once. */
  riskScore?: number | null;
  riskBand?: string | null;
  riskScoredAt?: string | null;
};

// Deliberately no impersonation anywhere in this console: "log in as this
// customer" is the single most dangerous feature an operator panel can
// have, and everything the support case actually needs — plan, quota,
// project state, last activity — is on this row already.
export async function getAdminUsers(limit = 200): Promise<AdminUserRow[]> {
  const supabase = createServiceClient();

  const [{ data, error }, { data: scores }] = await Promise.all([
    supabase.rpc("admin_users", { p_limit: limit }),
    supabase.from("fraud_scores").select("user_id, score, band, scored_at"),
  ]);

  if (error) {
    console.error("Échec admin_users", error.message);
    return [];
  }

  // The score the nightly sweep computed, Stripe signals included — the
  // same number the customer file shows. Computing a cheaper one here was
  // what made the two pages disagree.
  const byUser = new Map(
    ((scores ?? []) as {
      user_id: string;
      score: number;
      band: string;
      scored_at: string;
    }[]).map((row) => [row.user_id, row]),
  );

  return ((data ?? []) as AdminUserRow[]).map((user) => {
    const stored = byUser.get(user.id);
    return {
      ...user,
      riskScore: stored?.score ?? null,
      riskBand: stored?.band ?? null,
      riskScoredAt: stored?.scored_at ?? null,
    };
  });
}

export type AdminProjectRow = {
  id: string;
  name: string;
  base_url: string | null;
  owner_email: string | null;
  paused: boolean;
  targets: number;
  failing: number;
  last_checked_at: string | null;
  created_at: string;
};

export async function getAdminProjects(limit = 200): Promise<AdminProjectRow[]> {
  const { data, error } = await createServiceClient().rpc("admin_projects", {
    p_limit: limit,
  });
  if (error) {
    console.error("Échec admin_projects", error.message);
    return [];
  }
  return (data ?? []) as AdminProjectRow[];
}

export type AuditEntry = {
  id: number;
  username: string | null;
  action: string;
  target: string | null;
  detail: Record<string, unknown> | null;
  ip: string | null;
  created_at: string;
};

export async function getAuditLog(limit = 150): Promise<AuditEntry[]> {
  const { data } = await createServiceClient()
    .from("admin_audit_log")
    .select("id, username, action, target, detail, ip, created_at")
    .order("created_at", { ascending: false })
    .limit(limit);
  return (data ?? []) as AuditEntry[];
}

export type OutstandingInvoice = {
  id: string;
  customerId: string | null;
  customerEmail: string | null;
  amount: number;
  currency: string;
  created: number;
  ageDays: number;
  nextAttempt: number | null;
  attemptCount: number;
  hostedUrl: string | null;
};

// Money that was billed and hasn't arrived. Stripe knows the invoices;
// only we can put a customer email next to them, which is what turns a
// list of cus_… into something an operator can act on.
export async function getOutstandingInvoices(): Promise<OutstandingInvoice[]> {
  if (!process.env.STRIPE_SECRET_KEY) return [];

  try {
    const stripe = getStripe();
    const open = await stripe.invoices.list({ status: "open", limit: 50 });
    if (open.data.length === 0) return [];

    const customerIds = [
      ...new Set(
        open.data
          .map((i) => (typeof i.customer === "string" ? i.customer : (i.customer?.id ?? null)))
          .filter((id): id is string => Boolean(id)),
      ),
    ];

    const { data: profiles } = await createServiceClient()
      .from("profiles")
      .select("email, stripe_customer_id")
      .in("stripe_customer_id", customerIds);

    const emailByCustomer = new Map(
      (profiles ?? []).map((p) => [p.stripe_customer_id, p.email]),
    );

    const now = Date.now();
    return open.data
      .map((invoice) => {
        const customerId =
          typeof invoice.customer === "string"
            ? invoice.customer
            : (invoice.customer?.id ?? null);
        return {
          id: invoice.id ?? "",
          customerId,
          customerEmail: customerId ? (emailByCustomer.get(customerId) ?? null) : null,
          amount: invoice.amount_due,
          currency: invoice.currency,
          created: invoice.created,
          ageDays: Math.floor((now - invoice.created * 1000) / (24 * 60 * 60 * 1000)),
          nextAttempt: invoice.next_payment_attempt ?? null,
          attemptCount: invoice.attempt_count ?? 0,
          hostedUrl: invoice.hosted_invoice_url ?? null,
        };
      })
      // Oldest first: the one that has been unpaid longest is the one
      // closest to being written off.
      .sort((a, b) => a.created - b.created);
  } catch (err) {
    console.error("Échec lecture des impayés", err);
    return [];
  }
}
