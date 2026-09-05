import { runWithConcurrencyLimit } from "@/lib/concurrency";
import { createServiceClient } from "@/lib/db/service";
import { getFraudProfile } from "@/lib/admin-fraud-signals";
import type { FraudAssessment } from "@/lib/fraud-engine";
import { recordOpsEventThrottled } from "@/lib/ops-events";

// The nightly fraud sweep.
//
// The console computes a full score when an operator opens a customer
// file, but that is a page render: writing a fraud event as a side effect
// of someone looking at a screen would make the journal record who
// browsed rather than what happened. So the score that gets recorded is
// computed here, on a schedule, for everyone.

const DAY_MS = 24 * 60 * 60 * 1000;
// Each profile costs up to three Stripe calls, so the sweep is bounded
// rather than left to grow with the customer base.
const MAX_ACCOUNTS = 500;
const CONCURRENCY = 3;
// The band at which a human should look. Below this the score is context
// on a file someone opened, not a reason to interrupt anyone.
const FLAG_AT = 40;

export type SweepResult = {
  scanned: number;
  flagged: number;
  topScore: number;
};

export function shouldFlag(assessment: FraudAssessment): boolean {
  return assessment.score >= FLAG_AT;
}

export async function runRiskSweep(): Promise<SweepResult> {
  const supabase = createServiceClient();

  const { data: profiles } = await supabase
    .from("profiles")
    .select("id, email")
    .order("created_at", { ascending: false })
    .limit(MAX_ACCOUNTS);

  const accounts = profiles ?? [];
  let flagged = 0;
  let topScore = 0;

  await runWithConcurrencyLimit(accounts, CONCURRENCY, async (account) => {
    try {
      const { assessment } = await getFraudProfile(account.id);
      topScore = Math.max(topScore, assessment.score);
      if (!shouldFlag(assessment)) return;

      flagged += 1;
      // Once a day per account: a customer whose dispute stays open would
      // otherwise emit an identical event every night until it closes.
      await recordOpsEventThrottled(
        {
          source: "admin_alert",
          severity: "fraud",
          action: "risk.flagged",
          actorUserId: account.id,
          target: account.id,
          payload: {
            score: assessment.score,
            band: assessment.band,
            email: account.email,
            // The features, not just the number: whoever reads this later
            // needs to know what to look at.
            features: assessment.features.map((f) => ({
              id: f.id,
              label: f.label,
              points: f.points,
              evidence: f.evidence,
            })),
          },
        },
        DAY_MS,
      );
    } catch (err) {
      // One account failing must not stop the sweep for the rest.
      console.error("Échec évaluation de fraude", account.id, err);
    }
  });

  return { scanned: accounts.length, flagged, topScore };
}
