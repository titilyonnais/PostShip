// Fraud scoring.
//
// What this is not: a model. Supervised fraud detection needs labelled
// fraud, and this product has never recorded a confirmed case — training
// on an empty positive class produces a classifier that predicts "clean"
// with perfect accuracy and no value. Stripe Radar's advantage is
// precisely that it sees labelled outcomes across millions of merchants;
// that data cannot be reproduced here and pretending otherwise would be
// the worst possible outcome for a system meant to be trusted.
//
// What this is: the feature engineering that the literature says carries
// most of the signal, scored transparently. Bahnsen, Aouada, Stojanovic &
// Ottersten, "Feature engineering strategies for credit card fraud
// detection" (Expert Systems with Applications, 2016) establishes two
// families that repeatedly outperform raw attributes — RFM aggregation
// over several time windows, and periodic features that measure how far a
// transaction's time-of-day sits from the account's own habitual hour,
// using a circular (von Mises) distance rather than a linear one. Both
// are implemented below, adapted from card transactions to the events
// this product actually has.
//
// Every feature is bounded to [0, 1], multiplied by a weight, and
// reported with the number that produced it. A score with no explanation
// is not actionable, and an operator who cannot see why cannot disagree.

export type FraudFeatureId =
  | "linkage.accounts_per_ip"
  | "linkage.ips_per_account"
  | "linkage.shared_customer"
  | "linkage.disposable_email"
  | "velocity.signups_from_ip"
  | "velocity.failed_logins"
  | "velocity.account_age"
  | "payment.disputes"
  | "payment.failed_invoices"
  | "payment.past_due"
  | "payment.card_testing"
  | "payment.refund_rate"
  | "geo.country_spread"
  | "geo.impossible_travel"
  | "geo.card_country_mismatch"
  | "device.user_agent_spread"
  | "device.bot_session"
  | "behaviour.hour_deviation"
  | "behaviour.tokens_no_usage";

export type FraudFeature = {
  id: FraudFeatureId;
  label: string;
  /** Normalised contribution, 0..1. */
  value: number;
  weight: number;
  /** Points contributed, already rounded. */
  points: number;
  /** The raw observation, for the operator to check the reasoning. */
  evidence: string;
};

export type FraudInputs = {
  accountAgeDays: number;
  /** Highest number of distinct accounts seen on any one of this user's IPs. */
  maxAccountsPerIp: number;
  distinctIps30d: number;
  accountsSharingStripeCustomer: number;
  emailDomain: string | null;
  signupsFromSameIp30d: number;
  failedLogins24h: number;
  disputes: number;
  failedInvoices30d: number;
  pastDueDays: number;
  /** Failed charges under 200 minor units — the card-testing signature. */
  smallFailedCharges24h: number;
  refundedCharges: number;
  totalCharges: number;
  distinctCountries7d: number;
  /** Fastest implied travel between two consecutive visits, km/h. */
  maxImpliedSpeedKmh: number;
  /** Card issuing country vs the country the account browses from. */
  cardCountry: string | null;
  visitCountry: string | null;
  distinctUserAgents30d: number;
  botSessionSeen: boolean;
  /** Circular distance in hours between recent and habitual activity. */
  hourDeviation: number;
  tokensPurchased: boolean;
  projectCount: number;
};

// Weights are the judgement call, so they are stated in one place and
// justified rather than scattered through the code. They express relative
// severity, not probability — nothing here is calibrated against outcomes
// because there are no outcomes to calibrate against yet.
const WEIGHTS: Record<FraudFeatureId, number> = {
  // Payment evidence is the only category where the platform itself has
  // already made a judgement, so it dominates.
  "payment.disputes": 30,
  "payment.card_testing": 25,
  "payment.past_due": 12,
  "payment.failed_invoices": 12,
  "payment.refund_rate": 8,

  // Linkage is the strongest signal available without third-party data:
  // one person operating many accounts is the shape most abuse takes.
  "linkage.accounts_per_ip": 18,
  "linkage.shared_customer": 15,
  "linkage.ips_per_account": 8,
  "linkage.disposable_email": 10,

  "velocity.signups_from_ip": 14,
  "velocity.failed_logins": 10,
  "velocity.account_age": 6,

  "geo.impossible_travel": 16,
  "geo.card_country_mismatch": 10,
  "geo.country_spread": 6,

  "device.bot_session": 10,
  "device.user_agent_spread": 5,

  "behaviour.hour_deviation": 6,
  "behaviour.tokens_no_usage": 6,
};

// Disposable-address providers, kept short and specific. A long list goes
// stale and starts flagging legitimate privacy-conscious customers, which
// is worse than missing a few throwaways.
const DISPOSABLE_DOMAINS = new Set([
  "mailinator.com",
  "guerrillamail.com",
  "10minutemail.com",
  "yopmail.com",
  "tempmail.com",
  "temp-mail.org",
  "throwawaymail.com",
  "sharklasers.com",
  "getnada.com",
  "trashmail.com",
  "maildrop.cc",
  "dispostable.com",
]);

/** Saturating ramp: 0 at or below `from`, 1 at or above `to`. */
function ramp(value: number, from: number, to: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value <= from) return 0;
  if (value >= to) return 1;
  return (value - from) / (to - from);
}

// Bahnsen et al. measure how far a transaction's hour sits from the
// account's habitual hour, on a circle — 23:00 and 01:00 are two hours
// apart, not twenty-two. This is that distance, normalised: a full 12
// hours away is the maximum possible deviation.
export function circularHourDistance(a: number, b: number): number {
  const raw = Math.abs(a - b) % 24;
  return raw > 12 ? 24 - raw : raw;
}

// Great-circle distance, used to turn two timestamped locations into an
// implied travel speed. A login from Paris and one from São Paulo twenty
// minutes apart is not a trip.
export function haversineKm(
  a: { lat: number; lon: number },
  b: { lat: number; lon: number },
): number {
  const R = 6371;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);

  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type FraudAssessment = {
  score: number;
  band: "clean" | "watch" | "elevated" | "critical";
  features: FraudFeature[];
  /** Sum of every weight that could have fired, for context. */
  maxPossible: number;
};

function feature(
  id: FraudFeatureId,
  label: string,
  value: number,
  evidence: string,
): FraudFeature | null {
  if (value <= 0) return null;
  const weight = WEIGHTS[id];
  const bounded = Math.min(1, value);
  return {
    id,
    label,
    value: bounded,
    weight,
    points: Math.round(bounded * weight),
    evidence,
  };
}

export function assessFraud(input: FraudInputs): FraudAssessment {
  const features: (FraudFeature | null)[] = [
    // --- Payment: the platform has already judged these ---
    feature(
      "payment.disputes",
      "Litige de paiement",
      input.disputes > 0 ? 1 : 0,
      `${input.disputes} litige(s)`,
    ),
    // Many small failed charges in a day is the card-testing signature:
    // someone checking stolen numbers against a cheap endpoint.
    feature(
      "payment.card_testing",
      "Motif de test de cartes",
      ramp(input.smallFailedCharges24h, 2, 8),
      `${input.smallFailedCharges24h} petits paiements refusés en 24 h`,
    ),
    feature(
      "payment.past_due",
      "Impayé",
      ramp(input.pastDueDays, 3, 30),
      `${input.pastDueDays} jour(s) d'impayé`,
    ),
    feature(
      "payment.failed_invoices",
      "Factures en échec",
      ramp(input.failedInvoices30d, 2, 8),
      `${input.failedInvoices30d} sur 30 jours`,
    ),
    feature(
      "payment.refund_rate",
      "Taux de remboursement",
      input.totalCharges >= 3 ? ramp(input.refundedCharges / input.totalCharges, 0.3, 0.8) : 0,
      `${input.refundedCharges}/${input.totalCharges} paiements remboursés`,
    ),

    // --- Linkage: one person, many accounts ---
    feature(
      "linkage.accounts_per_ip",
      "Comptes multiples sur une même IP",
      ramp(input.maxAccountsPerIp, 2, 6),
      `${input.maxAccountsPerIp} comptes vus depuis une même adresse`,
    ),
    feature(
      "linkage.shared_customer",
      "Client Stripe partagé",
      input.accountsSharingStripeCustomer >= 2 ? 1 : 0,
      `${input.accountsSharingStripeCustomer} comptes sur le même client Stripe`,
    ),
    feature(
      "linkage.ips_per_account",
      "Adresses IP dispersées",
      ramp(input.distinctIps30d, 8, 40),
      `${input.distinctIps30d} adresses sur 30 jours`,
    ),
    feature(
      "linkage.disposable_email",
      "Email jetable",
      input.emailDomain && DISPOSABLE_DOMAINS.has(input.emailDomain) ? 1 : 0,
      input.emailDomain ?? "—",
    ),

    // --- Velocity: RFM frequency, per Bahnsen et al. ---
    feature(
      "velocity.signups_from_ip",
      "Inscriptions en rafale depuis l'IP",
      ramp(input.signupsFromSameIp30d, 2, 8),
      `${input.signupsFromSameIp30d} inscriptions sur 30 jours`,
    ),
    feature(
      "velocity.failed_logins",
      "Connexions échouées",
      ramp(input.failedLogins24h, 5, 25),
      `${input.failedLogins24h} en 24 h`,
    ),
    // Recency, in the RFM sense: a brand-new account has no history to
    // contradict a bad signal, so the same signal means more on it.
    feature(
      "velocity.account_age",
      "Compte très récent",
      input.accountAgeDays <= 1 ? 1 : ramp(7 - input.accountAgeDays, 0, 6),
      `${input.accountAgeDays} jour(s)`,
    ),

    // --- Geography ---
    // Commercial aviation tops out near 900 km/h; anything materially
    // above that is two people, or one person and a proxy.
    feature(
      "geo.impossible_travel",
      "Déplacement impossible",
      ramp(input.maxImpliedSpeedKmh, 900, 2000),
      `${Math.round(input.maxImpliedSpeedKmh)} km/h impliqués entre deux visites`,
    ),
    feature(
      "geo.card_country_mismatch",
      "Pays de la carte différent",
      input.cardCountry && input.visitCountry && input.cardCountry !== input.visitCountry
        ? 1
        : 0,
      `carte ${input.cardCountry ?? "?"} / navigation ${input.visitCountry ?? "?"}`,
    ),
    feature(
      "geo.country_spread",
      "Pays multiples",
      ramp(input.distinctCountries7d, 2, 6),
      `${input.distinctCountries7d} pays sur 7 jours`,
    ),

    // --- Device ---
    feature(
      "device.bot_session",
      "Session automatisée",
      input.botSessionSeen ? 1 : 0,
      "user-agent de robot sur une session authentifiée",
    ),
    feature(
      "device.user_agent_spread",
      "Appareils multiples",
      ramp(input.distinctUserAgents30d, 5, 20),
      `${input.distinctUserAgents30d} clients distincts sur 30 jours`,
    ),

    // --- Behaviour: the periodic feature ---
    feature(
      "behaviour.hour_deviation",
      "Horaire inhabituel",
      ramp(input.hourDeviation, 5, 11),
      `${input.hourDeviation.toFixed(1)} h d'écart circulaire avec l'habitude du compte`,
    ),
    feature(
      "behaviour.tokens_no_usage",
      "Achat sans usage",
      input.tokensPurchased && input.projectCount === 0 ? 1 : 0,
      "tokens achetés, aucun projet",
    ),
  ];

  const fired = features.filter((f): f is FraudFeature => f !== null);
  const score = Math.min(
    100,
    Math.round(fired.reduce((total, f) => total + f.points, 0)),
  );

  return {
    score,
    band: score >= 70 ? "critical" : score >= 40 ? "elevated" : score >= 15 ? "watch" : "clean",
    // Sorted by contribution: the first line an operator reads should be
    // the reason the score exists.
    features: fired.sort((a, b) => b.points - a.points),
    maxPossible: Object.values(WEIGHTS).reduce((a, b) => a + b, 0),
  };
}
