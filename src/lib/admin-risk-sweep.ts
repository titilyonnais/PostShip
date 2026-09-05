import { runWithConcurrencyLimit } from "@/lib/concurrency";
import { createServiceClient } from "@/lib/db/service";
import { getStripe } from "@/lib/stripe";
import { assessRisk, type RiskAssessment, type RiskSignals } from "@/lib/admin-risk";
import { recordOpsEventThrottled } from "@/lib/ops-events";

// The nightly risk sweep.
//
// The console computes a full score when an operator opens a customer
// file, but that is a page render: writing a fraud event as a side effect
// of someone looking at a screen would mean the journal records who
// browsed, not what happened. So the score that gets recorded is computed
// here, on a schedule, for everyone.
//
// Stripe is the expensive half — two calls per customer — so only
// accounts that actually have a Stripe customer pay for it, and the sweep
// is bounded so one bad night can't run away.

const DAY_MS = 24 * 60 * 60 * 1000;
const MAX_STRIPE_CUSTOMERS = 200;
const STRIPE_CONCURRENCY = 4;
const FLAG_THRESHOLD = 40;

type DbSignals = {
  user_id: string;
  failed_logins_24h: number;
  accounts_sharing_customer: number;
  tokens_purchased: boolean;
  project_count: number;
};

export type SweepCandidate = {
  userId: string;
  email: string | null;
  customerId: string | null;
  db: DbSignals;
};

export type SweepResult = {
  scanned: number;
  stripeChecked: number;
  flagged: number;
};

// Split out so the decision is testable without Stripe or a database:
// given the signals, who gets flagged and with what.
export function decideFlags(
  candidates: { userId: string; signals: RiskSignals }[],
): { userId: string; assessment: RiskAssessment }[] {
  return candidates
    .map((c) => ({ userId: c.userId, assessment: assessRisk(c.signals) }))
    .filter((c) => c.assessment.score >= FLAG_THRESHOLD);
}

async function stripeSignals(
  customerId: string,
): Promise<Pick<RiskSignals, "hasDispute" | "pastDueDays" | "failedInvoices30d">> {
  const none = { hasDispute: false, pastDueDays: 0, failedInvoices30d: 0 };
  try {
    const stripe = getStripe();
    const [invoices, charges, subs] = await Promise.all([
      stripe.invoices.list({ customer: customerId, limit: 30 }),
      stripe.charges.list({ customer: customerId, limit: 20 }),
      stripe.subscriptions.list({ customer: customerId, status: "all", limit: 5 }),
    ]);

    const now = Date.now();
    // An "open" invoice with attempts behind it is a failure; one merely
    // not due yet is not. Same distinction the console makes elsewhere.
    const failed = invoices.data.filter(
      (i) => i.status === "open" && (i.attempt_count ?? 0) > 0,
    );

    const pastDue = subs.data.some(
      (s) => s.status === "past_due" || s.status === "unpaid",
    );
    const oldestFailed = [...failed].sort((a, b) => a.created - b.created)[0];

    return {
      hasDispute: charges.data.some((c) => c.disputed),
      pastDueDays:
        pastDue && oldestFailed
          ? Math.floor((now - oldestFailed.created * 1000) / DAY_MS)
          : 0,
      failedInvoices30d: failed.filter((i) => now - i.created * 1000 < 30 * DAY_MS).length,
    };
  } catch (err) {
    // A Stripe outage must not turn into "everyone is clean" — it turns
    // into "no Stripe signal tonight", which the database signals still
    // sit on top of.
    console.error("Échec signaux Stripe (sweep)", customerId, err);
    return none;
  }
}

export async function runRiskSweep(): Promise<SweepResult> {
  const supabase = createServiceClient();

  const [{ data: signals }, { data: profiles }] = await Promise.all([
    supabase.rpc("admin_user_risk_signals"),
    supabase.from("profiles").select("id, email, stripe_customer_id"),
  ]);

  const byUser = new Map(
    ((signals ?? []) as DbSignals[]).map((row) => [row.user_id, row]),
  );

  const candidates: SweepCandidate[] = (profiles ?? []).map((p) => ({
    userId: p.id,
    email: p.email,
    customerId: p.stripe_customer_id,
    db: byUser.get(p.id) ?? {
      user_id: p.id,
      failed_logins_24h: 0,
      accounts_sharing_customer: 1,
      tokens_purchased: false,
      project_count: 0,
    },
  }));

  const withStripe = candidates
    .filter((c) => c.customerId)
    .slice(0, MAX_STRIPE_CUSTOMERS);

  const stripeByCustomer = new Map<string, Awaited<ReturnType<typeof stripeSignals>>>();
  await runWithConcurrencyLimit(withStripe, STRIPE_CONCURRENCY, async (candidate) => {
    stripeByCustomer.set(candidate.customerId!, await stripeSignals(candidate.customerId!));
  });

  const assessed = decideFlags(
    candidates.map((c) => {
      const stripe = c.customerId ? stripeByCustomer.get(c.customerId) : undefined;
      return {
        userId: c.userId,
        signals: {
          hasDispute: stripe?.hasDispute ?? false,
          pastDueDays: stripe?.pastDueDays ?? 0,
          failedInvoices30d: stripe?.failedInvoices30d ?? 0,
          failedLogins24h: Number(c.db.failed_logins_24h),
          accountsSharingCustomer: Number(c.db.accounts_sharing_customer),
          tokensPurchased: c.db.tokens_purchased,
          projectCount: Number(c.db.project_count),
        },
      };
    }),
  );

  for (const { userId, assessment } of assessed) {
    const candidate = candidates.find((c) => c.userId === userId);
    // Once a day per account, not once per sweep: a customer whose
    // dispute stays open would otherwise generate an identical fraud
    // event every night until it closes.
    await recordOpsEventThrottled(
      {
        source: "admin_alert",
        severity: "fraud",
        action: "risk.flagged",
        actorUserId: userId,
        target: userId,
        payload: {
          score: assessment.score,
          email: candidate?.email ?? null,
          // The rules, not just the number: a score alone gives whoever
          // reads this later nothing to act on.
          rules: assessment.rules.map((r) => ({ id: r.id, label: r.label, points: r.points })),
        },
      },
      DAY_MS,
    );
  }

  return {
    scanned: candidates.length,
    stripeChecked: withStripe.length,
    flagged: assessed.length,
  };
}
