import { describe, expect, it } from "vitest";
import { computeShipScore, type ShipScoreCheckResult } from "./ship-score";

function target(overrides: Partial<ShipScoreCheckResult> = {}): ShipScoreCheckResult {
  return {
    kind: "http",
    outcome: "pass",
    isMoneyPath: false,
    missing: null,
    sslDaysRemaining: null,
    ...overrides,
  };
}

describe("computeShipScore", () => {
  it("is 100 with no reason when everything passes", () => {
    const result = computeShipScore([target(), target({ kind: "og" }), target({ kind: "ssl", sslDaysRemaining: 60 })]);
    expect(result).toEqual({ score: 100, reason: null });
  });

  it("deducts 40 for a failing money-path URL", () => {
    const result = computeShipScore([target({ outcome: "fail", isMoneyPath: true })]);
    expect(result.score).toBe(60);
    expect(result.reason).toBe("−40 page argent");
  });

  it("deducts 25 for a missing asset", () => {
    const result = computeShipScore([target({ outcome: "fail", missing: ["asset:404:/app.js"] })]);
    expect(result.score).toBe(75);
    expect(result.reason).toBe("−25 asset manquant");
  });

  it("deducts 15 for a failing OG check", () => {
    const result = computeShipScore([target({ kind: "og", outcome: "fail" })]);
    expect(result.score).toBe(85);
    expect(result.reason).toBe("−15 carte OG");
  });

  it("deducts 10 for an SSL cert expiring within 14 days, even if the check itself passes", () => {
    const result = computeShipScore([target({ kind: "ssl", outcome: "pass", sslDaysRemaining: 5 })]);
    expect(result.score).toBe(90);
    expect(result.reason).toBe("−10 SSL bientôt expiré");
  });

  it("does not deduct for an SSL cert with 14+ days left", () => {
    const result = computeShipScore([target({ kind: "ssl", outcome: "pass", sslDaysRemaining: 14 })]);
    expect(result.score).toBe(100);
  });

  it("deducts 10 for any other failing URL", () => {
    const result = computeShipScore([target({ kind: "sitemap", outcome: "fail" })]);
    expect(result.score).toBe(90);
    expect(result.reason).toBe("−10 URL en échec");
  });

  it("sums deductions across multiple failing targets", () => {
    const result = computeShipScore([
      target({ outcome: "fail", isMoneyPath: true }),
      target({ kind: "og", outcome: "fail" }),
    ]);
    expect(result.score).toBe(45);
  });

  it("clamps at 0 rather than going negative", () => {
    const result = computeShipScore([
      target({ outcome: "fail", isMoneyPath: true }),
      target({ outcome: "fail", isMoneyPath: true }),
      target({ outcome: "fail", isMoneyPath: true }),
    ]);
    expect(result.score).toBe(0);
  });

  it("picks the single highest-point category as the explanation line", () => {
    const result = computeShipScore([
      target({ kind: "og", outcome: "fail" }),
      target({ outcome: "fail", isMoneyPath: true }),
      target({ kind: "sitemap", outcome: "fail" }),
    ]);
    expect(result.reason).toBe("−40 page argent");
  });

  it("does not double-count a money-path URL as also 'other'", () => {
    const result = computeShipScore([target({ outcome: "fail", isMoneyPath: true })]);
    expect(result.score).toBe(60);
  });
});
