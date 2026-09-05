import { describe, expect, it } from "vitest";
import { assessRisk, type RiskSignals } from "./admin-risk";

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

describe("assessRisk", () => {
  it("scores a clean account at zero with nothing to show", () => {
    const result = assessRisk(CLEAN);
    expect(result).toEqual({ score: 0, level: "none", rules: [] });
  });

  it("weights each rule as specified", () => {
    expect(assessRisk(signals({ hasDispute: true })).score).toBe(40);
    expect(assessRisk(signals({ pastDueDays: 8 })).score).toBe(25);
    expect(assessRisk(signals({ failedInvoices30d: 5 })).score).toBe(15);
    expect(assessRisk(signals({ failedLogins24h: 8 })).score).toBe(15);
    expect(assessRisk(signals({ accountsSharingCustomer: 3 })).score).toBe(10);
    expect(
      assessRisk(signals({ tokensPurchased: true, projectCount: 0 })).score,
    ).toBe(10);
  });

  it("respects the thresholds rather than firing one short", () => {
    // past_due is "> 7", not ">= 7".
    expect(assessRisk(signals({ pastDueDays: 7 })).score).toBe(0);
    expect(assessRisk(signals({ failedInvoices30d: 4 })).score).toBe(0);
    expect(assessRisk(signals({ failedLogins24h: 7 })).score).toBe(0);
    expect(assessRisk(signals({ accountsSharingCustomer: 2 })).score).toBe(0);
  });

  it("does not flag tokens bought by someone who does have projects", () => {
    expect(assessRisk(signals({ tokensPurchased: true, projectCount: 1 })).score).toBe(0);
  });

  it("adds up and names every rule that matched", () => {
    const result = assessRisk(
      signals({ hasDispute: true, pastDueDays: 30, failedInvoices30d: 6 }),
    );
    expect(result.score).toBe(80);
    expect(result.rules.map((r) => r.id)).toEqual([
      "dispute",
      "past_due",
      "failed_invoices",
    ]);
    // The label carries the number, so the operator sees the evidence and
    // not just the verdict.
    expect(result.rules[1].label).toContain("30 jours");
  });

  it("caps at 100 when everything fires at once", () => {
    const result = assessRisk({
      hasDispute: true,
      pastDueDays: 60,
      failedInvoices30d: 9,
      failedLogins24h: 20,
      accountsSharingCustomer: 4,
      tokensPurchased: true,
      projectCount: 0,
    });
    expect(result.score).toBe(100);
    expect(result.rules).toHaveLength(6);
  });

  it("crosses into high at exactly 40", () => {
    expect(assessRisk(signals({ hasDispute: true })).level).toBe("high");
    expect(assessRisk(signals({ pastDueDays: 8 })).level).toBe("watch");
    expect(
      assessRisk(signals({ pastDueDays: 8, failedInvoices30d: 5 })).level,
    ).toBe("high");
  });
});
