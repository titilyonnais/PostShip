// Deterministic risk scoring. No model, no heuristic that drifts — a
// fixed set of rules whose inputs are all facts already in the database
// or in Stripe.
//
// The score alone is deliberately never shown on its own. "72" tells an
// operator nothing actionable; "dispute ouvert + 5 factures échouées"
// tells them what to look at. Every surface that renders a score renders
// the matched rules beside it.

export type RiskSignals = {
  /** A dispute currently open, or one already lost. */
  hasDispute: boolean;
  /** Days a subscription has been past_due, 0 when it isn't. */
  pastDueDays: number;
  failedInvoices30d: number;
  failedLogins24h: number;
  /** Accounts sharing this Stripe customer id. Should always be 1. */
  accountsSharingCustomer: number;
  tokensPurchased: boolean;
  projectCount: number;
};

export type RiskRule = { id: string; points: number; label: string };

export type RiskAssessment = {
  score: number;
  level: "none" | "watch" | "high";
  rules: RiskRule[];
};

export function assessRisk(signals: RiskSignals): RiskAssessment {
  const rules: RiskRule[] = [];

  if (signals.hasDispute) {
    rules.push({
      id: "dispute",
      points: 40,
      label: "Litige de paiement ouvert ou perdu",
    });
  }

  if (signals.pastDueDays > 7) {
    rules.push({
      id: "past_due",
      points: 25,
      label: `Abonnement impayé depuis ${signals.pastDueDays} jours`,
    });
  }

  if (signals.failedInvoices30d >= 5) {
    rules.push({
      id: "failed_invoices",
      points: 15,
      label: `${signals.failedInvoices30d} factures en échec sur 30 jours`,
    });
  }

  if (signals.failedLogins24h >= 8) {
    rules.push({
      id: "failed_logins",
      points: 15,
      label: `${signals.failedLogins24h} connexions échouées en 24 h`,
    });
  }

  // Two profiles pointing at one Stripe customer means our own linkage is
  // wrong, or someone is recycling a payment method across accounts.
  // Either way it is worth a human look.
  if (signals.accountsSharingCustomer >= 3) {
    rules.push({
      id: "shared_customer",
      points: 10,
      label: `${signals.accountsSharingCustomer} comptes partagent le même client Stripe`,
    });
  }

  if (signals.tokensPurchased && signals.projectCount === 0) {
    rules.push({
      id: "tokens_no_project",
      points: 10,
      label: "Tokens achetés, aucun projet créé",
    });
  }

  // Capped: a score above 100 would suggest a precision the rules don't
  // have, and every rule past the cap is already in the list anyway.
  const score = Math.min(100, rules.reduce((total, rule) => total + rule.points, 0));

  return {
    score,
    level: score >= 40 ? "high" : score > 0 ? "watch" : "none",
    rules,
  };
}
