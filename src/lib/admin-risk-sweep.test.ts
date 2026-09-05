import { describe, expect, it } from "vitest";
import { decideFlags } from "./admin-risk-sweep";
import type { RiskSignals } from "./admin-risk";

const CLEAN: RiskSignals = {
  hasDispute: false,
  pastDueDays: 0,
  failedInvoices30d: 0,
  failedLogins24h: 0,
  accountsSharingCustomer: 1,
  tokensPurchased: false,
  projectCount: 2,
};

const signals = (over: Partial<RiskSignals> = {}): RiskSignals => ({ ...CLEAN, ...over });

describe("decideFlags", () => {
  it("flags nobody when everyone is clean", () => {
    expect(decideFlags([{ userId: "a", signals: CLEAN }])).toEqual([]);
  });

  it("flags only accounts at or above the threshold", () => {
    const flagged = decideFlags([
      { userId: "clean", signals: CLEAN },
      // 25 — real, but not enough to wake anyone at night.
      { userId: "watch", signals: signals({ pastDueDays: 10 }) },
      // 40 — a dispute on its own.
      { userId: "dispute", signals: signals({ hasDispute: true }) },
      // 25 + 15 = 40, exactly on the line.
      { userId: "sum", signals: signals({ pastDueDays: 10, failedInvoices30d: 5 }) },
    ]);

    expect(flagged.map((f) => f.userId)).toEqual(["dispute", "sum"]);
  });

  it("carries the matched rules, not just the score", () => {
    const [flagged] = decideFlags([
      {
        userId: "u",
        signals: signals({ hasDispute: true, pastDueDays: 20 }),
      },
    ]);

    expect(flagged.assessment.score).toBe(65);
    expect(flagged.assessment.rules.map((r) => r.id)).toEqual(["dispute", "past_due"]);
    expect(flagged.assessment.rules[1].label).toContain("20 jours");
  });

  it("cannot flag on database signals alone, by arithmetic", () => {
    // Every signal that lives in our own database, maxed out: 15 for
    // failed logins, 10 for a shared customer, 10 for tokens with no
    // project. That is 35, and the threshold is 40 — so a Stripe silence
    // can never manufacture a flag on its own. Worth pinning: it means a
    // Stripe outage during the sweep produces no false alarms.
    const flagged = decideFlags([
      {
        userId: "db-only",
        signals: signals({
          failedLogins24h: 99,
          accountsSharingCustomer: 9,
          tokensPurchased: true,
          projectCount: 0,
        }),
      },
    ]);

    expect(flagged).toEqual([]);
  });

  it("flags as soon as one Stripe signal joins the database ones", () => {
    const flagged = decideFlags([
      {
        userId: "mixed",
        signals: signals({
          failedLogins24h: 12,
          tokensPurchased: true,
          projectCount: 0,
          failedInvoices30d: 5,
        }),
      },
    ]);

    // 15 + 10 + 15 = 40, exactly on the line.
    expect(flagged).toHaveLength(1);
    expect(flagged[0].assessment.score).toBe(40);
  });
});
