import { createServiceClient } from "@/lib/db/service";
import { getStripe } from "@/lib/stripe";
import { getFraudProfile, type FraudProfile } from "@/lib/admin-fraud-signals";

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

export type VisitRow = {
  at: string;
  ip: string;
  path: string;
  country: string | null;
  city: string | null;
  device: string | null;
  browser: string | null;
  os: string | null;
  userAgent: string | null;
  isBot: boolean;
};

export type UserFootprint = {
  addresses: {
    ip: string;
    hits: number;
    firstSeen: string;
    lastSeen: string;
    country: string | null;
    city: string | null;
    region: string | null;
    timezone: string | null;
    latitude: number | null;
    longitude: number | null;
    distinctUsers: number;
    trusted: boolean;
  }[];
  visits: VisitRow[];
};

export type UserDetail = {
  identity: UserIdentity;
  usage: UserUsage;
  payment: UserPayment;
  fraud: FraudProfile;
  footprint: UserFootprint;
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

// Everything observed about where this person connects from and on
// what. The addresses come from the rolled-up table, the visits from the
// raw stream — the first answers "who is this", the second answers "what
// did they just do".
async function loadFootprint(userId: string): Promise<UserFootprint> {
  const supabase = createServiceClient();

  const { data: links } = await supabase
    .from("visitor_identities")
    .select("ip, hits, first_seen_at, last_seen_at")
    .eq("user_id", userId)
    .order("last_seen_at", { ascending: false })
    .limit(50);

  const ips = (links ?? []).map((l) => l.ip);

  const [{ data: profiles }, { data: visits }] = await Promise.all([
    ips.length
      ? supabase
          .from("visitor_ips")
          .select("ip, country, region, city, timezone, latitude, longitude, distinct_users, trusted")
          .in("ip", ips)
      : Promise.resolve({ data: [] }),
    supabase
      .from("visits")
      .select("at, ip, path, country, city, device, browser, os, user_agent, is_bot")
      .eq("user_id", userId)
      .order("at", { ascending: false })
      .limit(50),
  ]);

  const byIp = new Map((profiles ?? []).map((p) => [p.ip, p]));

  return {
    addresses: (links ?? []).map((link) => {
      const geo = byIp.get(link.ip);
      return {
        ip: link.ip,
        hits: Number(link.hits),
        firstSeen: link.first_seen_at,
        lastSeen: link.last_seen_at,
        country: geo?.country ?? null,
        city: geo?.city ?? null,
        region: geo?.region ?? null,
        timezone: geo?.timezone ?? null,
        latitude: geo?.latitude ?? null,
        longitude: geo?.longitude ?? null,
        distinctUsers: geo?.distinct_users ?? 0,
        trusted: Boolean(geo?.trusted),
      };
    }),
    visits: ((visits ?? []) as Record<string, unknown>[]).map((v) => ({
      at: v.at as string,
      ip: v.ip as string,
      path: v.path as string,
      country: (v.country as string) ?? null,
      city: (v.city as string) ?? null,
      device: (v.device as string) ?? null,
      browser: (v.browser as string) ?? null,
      os: (v.os as string) ?? null,
      userAgent: (v.user_agent as string) ?? null,
      isBot: Boolean(v.is_bot),
    })),
  };
}

export async function getUserDetail(userId: string): Promise<UserDetail | null> {
  const identity = await loadIdentity(userId);
  if (!identity) return null;

  const [usage, payment, fraud, footprint] = await Promise.all([
    loadUsage(userId),
    loadPayment(identity.stripeCustomerId),
    getFraudProfile(userId),
    loadFootprint(userId),
  ]);

  return { identity, usage, payment, fraud, footprint };
}
