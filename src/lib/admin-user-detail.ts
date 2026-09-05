import { createServiceClient } from "@/lib/db/service";
import { getStripe } from "@/lib/stripe";
import { assessRisk, type RiskAssessment, type RiskSignals } from "@/lib/admin-risk";

// Everything the console shows about one customer, assembled from the
// three places it actually lives: profiles, Supabase Auth, and Stripe.
//
// Read-only by construction. The actions that change anything live in
// their own file so this can never be the thing that mutates state while
// rendering a page.

const DAY_MS = 24 * 60 * 60 * 1000;

export type UserIdentity = {
  id: string;
  email: string | null;
  username: string | null;
  displayName: string | null;
  createdAt: string | null;
  lastSignInAt: string | null;
  bannedUntil: string | null;
  providers: string[];
  plan: string | null;
  tokenBalance: number;
  stripeCustomerId: string | null;
  stripeSubscriptionStatus: string | null;
};

export type UserUsage = {
  projects: number;
  targets: number;
  checkRuns7d: number;
  scans7d: number;
  recentProjects: { id: string; name: string; lastStatus: string | null }[];
};

export type UserPayment = {
  available: boolean;
  currency: string;
  subscriptions: {
    id: string;
    status: string;
    cancelAtPeriodEnd: boolean;
    currentPeriodEnd: number | null;
    priceLabel: string;
  }[];
  invoices: {
    id: string;
    number: string | null;
    created: number;
    amount: number;
    status: string;
    hostedUrl: string | null;
    nextAttempt: number | null;
  }[];
  charges: {
    id: string;
    created: number;
    amount: number;
    status: string;
    refunded: boolean;
    disputed: boolean;
    /** A refund is offered only while Stripe will still accept one. */
    refundable: boolean;
  }[];
  portalCustomerUrl: string | null;
};

export type UserDetail = {
  identity: UserIdentity;
  usage: UserUsage;
  payment: UserPayment;
  risk: RiskAssessment;
  riskSignals: RiskSignals;
};

async function loadIdentity(userId: string): Promise<UserIdentity | null> {
  const supabase = createServiceClient();

  const [{ data: profile }, { data: authUser }] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "id, email, username, display_name, plan, token_balance, stripe_customer_id, stripe_subscription_status, created_at",
      )
      .eq("id", userId)
      .maybeSingle(),
    supabase.auth.admin.getUserById(userId),
  ]);

  if (!profile) return null;

  const user = authUser?.user;
  return {
    id: profile.id,
    email: profile.email ?? user?.email ?? null,
    username: profile.username,
    displayName: profile.display_name,
    createdAt: profile.created_at ?? user?.created_at ?? null,
    lastSignInAt: user?.last_sign_in_at ?? null,
    bannedUntil: (user as { banned_until?: string | null } | undefined)?.banned_until ?? null,
    providers: (user?.identities ?? []).map((i) => i.provider),
    plan: profile.plan,
    tokenBalance: profile.token_balance ?? 0,
    stripeCustomerId: profile.stripe_customer_id,
    stripeSubscriptionStatus: profile.stripe_subscription_status,
  };
}

async function loadUsage(userId: string): Promise<UserUsage> {
  const supabase = createServiceClient();
  const since = new Date(Date.now() - 7 * DAY_MS).toISOString();

  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, last_status")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });

  const ids = (projects ?? []).map((p) => p.id);

  const [targets, runs, scans] = await Promise.all([
    ids.length
      ? supabase
          .from("check_targets")
          .select("id", { count: "exact", head: true })
          .in("project_id", ids)
      : Promise.resolve({ count: 0 }),
    ids.length
      ? supabase
          .from("check_runs")
          .select("id", { count: "exact", head: true })
          .in("project_id", ids)
          .gte("started_at", since)
      : Promise.resolve({ count: 0 }),
    supabase
      .from("site_scans")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId)
      .gte("created_at", since),
  ]);

  return {
    projects: projects?.length ?? 0,
    targets: targets.count ?? 0,
    checkRuns7d: runs.count ?? 0,
    scans7d: scans.count ?? 0,
    recentProjects: (projects ?? []).slice(0, 8).map((p) => ({
      id: p.id,
      name: p.name,
      lastStatus: p.last_status,
    })),
  };
}

const REFUND_WINDOW_MS = 14 * DAY_MS;

async function loadPayment(customerId: string | null): Promise<UserPayment> {
  const empty: UserPayment = {
    available: false,
    currency: "eur",
    subscriptions: [],
    invoices: [],
    charges: [],
    portalCustomerUrl: null,
  };

  if (!customerId || !process.env.STRIPE_SECRET_KEY) return empty;

  try {
    const stripe = getStripe();
    const [subs, invoices, charges] = await Promise.all([
      stripe.subscriptions.list({ customer: customerId, status: "all", limit: 10 }),
      stripe.invoices.list({ customer: customerId, limit: 20 }),
      stripe.charges.list({ customer: customerId, limit: 20 }),
    ]);

    const currency = invoices.data[0]?.currency ?? charges.data[0]?.currency ?? "eur";
    const now = Date.now();

    return {
      available: true,
      currency,
      subscriptions: subs.data.map((s) => {
        const item = s.items.data[0];
        const price = item?.price;
        return {
          id: s.id,
          status: s.status,
          cancelAtPeriodEnd: Boolean(s.cancel_at_period_end),
          currentPeriodEnd:
            (item as { current_period_end?: number } | undefined)?.current_period_end ??
            (s as unknown as { current_period_end?: number }).current_period_end ??
            null,
          priceLabel: price
            ? `${((price.unit_amount ?? 0) / 100).toFixed(2)} ${price.currency.toUpperCase()} / ${price.recurring?.interval ?? "unique"}`
            : "—",
        };
      }),
      invoices: invoices.data.map((i) => ({
        id: i.id ?? "",
        number: i.number ?? null,
        created: i.created,
        amount: i.amount_paid > 0 ? i.amount_paid : i.amount_due,
        // Same distinction as the customer-facing billing tab: an "open"
        // invoice with attempts behind it is a failure, not something
        // merely not due yet.
        status:
          i.status === "open" && (i.attempt_count ?? 0) > 0 ? "failed" : (i.status ?? "open"),
        hostedUrl: i.hosted_invoice_url ?? null,
        nextAttempt: i.next_payment_attempt ?? null,
      })),
      charges: charges.data.map((c) => ({
        id: c.id,
        created: c.created,
        amount: c.amount,
        status: c.status,
        refunded: c.refunded,
        disputed: Boolean(c.disputed),
        refundable:
          c.status === "succeeded" &&
          !c.refunded &&
          !c.disputed &&
          now - c.created * 1000 < REFUND_WINDOW_MS,
      })),
      portalCustomerUrl: `https://dashboard.stripe.com/customers/${customerId}`,
    };
  } catch (err) {
    console.error("Échec lecture Stripe (fiche client)", err);
    return empty;
  }
}

async function loadRiskSignals(
  identity: UserIdentity,
  usage: UserUsage,
  payment: UserPayment,
): Promise<RiskSignals> {
  const supabase = createServiceClient();
  const now = Date.now();

  const [{ count: failedLogins }, { count: sharing }, { count: purchases }] =
    await Promise.all([
      supabase
        .from("ops_events")
        .select("id", { count: "exact", head: true })
        .eq("source", "auth")
        .eq("actor_user_id", identity.id)
        .like("action", "%failed%")
        .gte("at", new Date(now - DAY_MS).toISOString()),
      identity.stripeCustomerId
        ? supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("stripe_customer_id", identity.stripeCustomerId)
        : Promise.resolve({ count: 1 }),
      supabase
        .from("token_purchases")
        .select("id", { count: "exact", head: true })
        .eq("user_id", identity.id),
    ]);

  // Days past due is measured from the oldest failed invoice, which is
  // when the money actually stopped arriving — the subscription's own
  // status carries no date.
  const oldestFailed = payment.invoices
    .filter((i) => i.status === "failed")
    .sort((a, b) => a.created - b.created)[0];
  const pastDue =
    payment.subscriptions.some((s) => s.status === "past_due" || s.status === "unpaid") &&
    oldestFailed
      ? Math.floor((now - oldestFailed.created * 1000) / DAY_MS)
      : 0;

  return {
    hasDispute: payment.charges.some((c) => c.disputed),
    pastDueDays: pastDue,
    failedInvoices30d: payment.invoices.filter(
      (i) => i.status === "failed" && now - i.created * 1000 < 30 * DAY_MS,
    ).length,
    failedLogins24h: failedLogins ?? 0,
    accountsSharingCustomer: sharing ?? 1,
    tokensPurchased: (purchases ?? 0) > 0 || identity.tokenBalance > 0,
    projectCount: usage.projects,
  };
}

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const identity = await loadIdentity(userId);
  if (!identity) return null;

  const [usage, payment] = await Promise.all([
    loadUsage(userId),
    loadPayment(identity.stripeCustomerId),
  ]);

  const riskSignals = await loadRiskSignals(identity, usage, payment);

  return { identity, usage, payment, risk: assessRisk(riskSignals), riskSignals };
}
