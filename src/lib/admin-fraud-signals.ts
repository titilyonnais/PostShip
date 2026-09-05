import { createServiceClient } from "@/lib/db/service";
import { getStripe } from "@/lib/stripe";
import {
  assessFraud,
  circularHourDistance,
  type FraudAssessment,
  type FraudInputs,
} from "@/lib/fraud-engine";

// Assembles the engine's inputs from the three places they live: our own
// telemetry (one SQL function, because the joins are maxima over a user's
// whole visit history), Stripe, and the profile row.
//
// Stripe is optional throughout. When it can't be reached the payment
// features simply don't fire — they are never guessed, because a guessed
// dispute is worse than a missing one.

const DAY_MS = 24 * 60 * 60 * 1000;
// Stripe's own card-testing guidance is about many small authorisations
// in quick succession; two euros is comfortably below any real plan here.
const SMALL_CHARGE_MAX = 200;

type DbSignals = {
  max_accounts_per_ip: number;
  distinct_ips_30d: number;
  signups_from_same_ip_30d: number;
  distinct_countries_7d: number;
  max_implied_speed_kmh: number;
  distinct_user_agents_30d: number;
  bot_session_seen: boolean;
  visit_country: string | null;
  mean_hour: number;
  latest_hour: number;
  failed_logins_24h: number;
};

export type FraudProfile = {
  assessment: FraudAssessment;
  inputs: FraudInputs;
};

export async function getFraudProfile(userId: string): Promise<FraudProfile> {
  const supabase = createServiceClient();

  const [{ data: signalsRaw }, { data: profile }] = await Promise.all([
    supabase.rpc("fraud_signals", { p_user_id: userId }),
    supabase
      .from("profiles")
      .select("email, created_at, token_balance, stripe_customer_id")
      .eq("id", userId)
      .maybeSingle(),
  ]);

  const db = (signalsRaw ?? {}) as Partial<DbSignals>;

  const [{ count: projectCount }, { count: sharing }, { count: purchases }] =
    await Promise.all([
      supabase.from("projects").select("id", { count: "exact", head: true }).eq("user_id", userId),
      profile?.stripe_customer_id
        ? supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("stripe_customer_id", profile.stripe_customer_id)
        : Promise.resolve({ count: 1 }),
      supabase
        .from("token_purchases")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId),
    ]);

  const payment = await stripeSignals(profile?.stripe_customer_id ?? null);

  const inputs: FraudInputs = {
    accountAgeDays: profile?.created_at
      ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / DAY_MS)
      : 999,
    maxAccountsPerIp: Number(db.max_accounts_per_ip ?? 0),
    distinctIps30d: Number(db.distinct_ips_30d ?? 0),
    accountsSharingStripeCustomer: sharing ?? 1,
    emailDomain: profile?.email?.split("@")[1]?.toLowerCase() ?? null,
    signupsFromSameIp30d: Number(db.signups_from_same_ip_30d ?? 0),
    failedLogins24h: Number(db.failed_logins_24h ?? 0),
    ...payment,
    distinctCountries7d: Number(db.distinct_countries_7d ?? 0),
    maxImpliedSpeedKmh: Number(db.max_implied_speed_kmh ?? 0),
    visitCountry: db.visit_country ?? null,
    distinctUserAgents30d: Number(db.distinct_user_agents_30d ?? 0),
    botSessionSeen: Boolean(db.bot_session_seen),
    // The periodic feature: how far the most recent activity sits from
    // the account's own habitual hour, measured on a circle.
    hourDeviation: circularHourDistance(
      Number(db.latest_hour ?? 12),
      Number(db.mean_hour ?? 12),
    ),
    tokensPurchased: (purchases ?? 0) > 0 || (profile?.token_balance ?? 0) > 0,
    projectCount: projectCount ?? 0,
  };

  return { assessment: assessFraud(inputs), inputs };
}

type PaymentSignals = Pick<
  FraudInputs,
  | "disputes"
  | "failedInvoices30d"
  | "pastDueDays"
  | "smallFailedCharges24h"
  | "refundedCharges"
  | "totalCharges"
  | "cardCountry"
>;

async function stripeSignals(customerId: string | null): Promise<PaymentSignals> {
  const none: PaymentSignals = {
    disputes: 0,
    failedInvoices30d: 0,
    pastDueDays: 0,
    smallFailedCharges24h: 0,
    refundedCharges: 0,
    totalCharges: 0,
    cardCountry: null,
  };

  if (!customerId || !process.env.STRIPE_SECRET_KEY) return none;

  try {
    const stripe = getStripe();
    const [invoices, charges, subs] = await Promise.all([
      stripe.invoices.list({ customer: customerId, limit: 40 }),
      stripe.charges.list({ customer: customerId, limit: 50 }),
      stripe.subscriptions.list({ customer: customerId, status: "all", limit: 5 }),
    ]);

    const now = Date.now();
    const failedInvoices = invoices.data.filter(
      (i) => i.status === "open" && (i.attempt_count ?? 0) > 0,
    );
    const oldestFailed = [...failedInvoices].sort((a, b) => a.created - b.created)[0];
    const pastDue = subs.data.some((s) => s.status === "past_due" || s.status === "unpaid");

    return {
      disputes: charges.data.filter((c) => c.disputed).length,
      failedInvoices30d: failedInvoices.filter((i) => now - i.created * 1000 < 30 * DAY_MS)
        .length,
      pastDueDays:
        pastDue && oldestFailed
          ? Math.floor((now - oldestFailed.created * 1000) / DAY_MS)
          : 0,
      smallFailedCharges24h: charges.data.filter(
        (c) =>
          c.status === "failed" &&
          c.amount <= SMALL_CHARGE_MAX &&
          now - c.created * 1000 < DAY_MS,
      ).length,
      refundedCharges: charges.data.filter((c) => c.refunded).length,
      totalCharges: charges.data.length,
      // The issuing country of the card actually used, which is the only
      // place this is knowable.
      cardCountry:
        charges.data
          .map((c) => c.payment_method_details?.card?.country ?? null)
          .find((country): country is string => Boolean(country)) ?? null,
    };
  } catch (err) {
    console.error("Échec signaux Stripe (fraude)", customerId, err);
    return none;
  }
}
