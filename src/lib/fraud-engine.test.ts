import { describe, expect, it } from "vitest";
import {
  assessFraud,
  circularHourDistance,
  haversineKm,
  type FraudInputs,
} from "./fraud-engine";

const CLEAN: FraudInputs = {
  accountAgeDays: 400,
  maxAccountsPerIp: 1,
  distinctIps30d: 3,
  accountsSharingStripeCustomer: 1,
  emailDomain: "gmail.com",
  signupsFromSameIp30d: 1,
  failedLogins24h: 0,
  disputes: 0,
  failedInvoices30d: 0,
  pastDueDays: 0,
  smallFailedCharges24h: 0,
  refundedCharges: 0,
  totalCharges: 12,
  distinctCountries7d: 1,
  maxImpliedSpeedKmh: 60,
  cardCountry: "FR",
  visitCountry: "FR",
  distinctUserAgents30d: 2,
  botSessionSeen: false,
  hourDeviation: 1.2,
  tokensPurchased: false,
  projectCount: 3,
};

const inputs = (over: Partial<FraudInputs> = {}): FraudInputs => ({ ...CLEAN, ...over });

describe("circularHourDistance", () => {
  it("measures across midnight the short way", () => {
    // The point of the periodic feature in Bahnsen et al.: 23:00 and
    // 01:00 are two hours apart, not twenty-two.
    expect(circularHourDistance(23, 1)).toBe(2);
    expect(circularHourDistance(1, 23)).toBe(2);
    expect(circularHourDistance(9, 9)).toBe(0);
    expect(circularHourDistance(0, 12)).toBe(12);
  });
});

describe("haversineKm", () => {
  it("matches known distances within a percent", () => {
    // Paris → New York is about 5 837 km.
    const d = haversineKm({ lat: 48.8566, lon: 2.3522 }, { lat: 40.7128, lon: -74.006 });
    expect(d).toBeGreaterThan(5750);
    expect(d).toBeLessThan(5900);
    expect(haversineKm({ lat: 0, lon: 0 }, { lat: 0, lon: 0 })).toBe(0);
  });
});

describe("assessFraud", () => {
  it("scores an ordinary account clean, with nothing to explain", () => {
    const result = assessFraud(CLEAN);
    expect(result.score).toBe(0);
    expect(result.band).toBe("clean");
    expect(result.features).toEqual([]);
  });

  it("treats a dispute as the single heaviest signal", () => {
    const result = assessFraud(inputs({ disputes: 1 }));
    expect(result.score).toBe(30);
    expect(result.features[0].id).toBe("payment.disputes");
  });

  it("recognises the card-testing pattern and escalates with volume", () => {
    const few = assessFraud(inputs({ smallFailedCharges24h: 3 }));
    const many = assessFraud(inputs({ smallFailedCharges24h: 10 }));
    expect(many.score).toBeGreaterThan(few.score);
    expect(many.features[0].id).toBe("payment.card_testing");
    expect(many.features[0].points).toBe(25);
  });

  it("ignores travel a plane could make and flags what it couldn't", () => {
    expect(assessFraud(inputs({ maxImpliedSpeedKmh: 800 })).score).toBe(0);
    const teleport = assessFraud(inputs({ maxImpliedSpeedKmh: 2500 }));
    expect(teleport.features.map((f) => f.id)).toContain("geo.impossible_travel");
  });

  it("needs a real sample before judging a refund rate", () => {
    // Two charges, both refunded, is a new customer who changed their
    // mind — not a pattern.
    expect(assessFraud(inputs({ totalCharges: 2, refundedCharges: 2 })).score).toBe(0);
    expect(
      assessFraud(inputs({ totalCharges: 10, refundedCharges: 8 })).score,
    ).toBeGreaterThan(0);
  });

  it("weights linkage heavily, since one person with many accounts is the usual shape", () => {
    const result = assessFraud(inputs({ maxAccountsPerIp: 6, accountsSharingStripeCustomer: 3 }));
    const ids = result.features.map((f) => f.id);
    expect(ids).toContain("linkage.accounts_per_ip");
    expect(ids).toContain("linkage.shared_customer");
    expect(result.score).toBeGreaterThanOrEqual(33);
  });

  it("flags a disposable domain but not an ordinary one", () => {
    expect(assessFraud(inputs({ emailDomain: "mailinator.com" })).score).toBe(10);
    expect(assessFraud(inputs({ emailDomain: "protonmail.com" })).score).toBe(0);
  });

  it("orders the explanation by contribution, heaviest first", () => {
    const result = assessFraud(
      inputs({ disputes: 1, failedLogins24h: 30, distinctCountries7d: 6 }),
    );
    const points = result.features.map((f) => f.points);
    expect(points).toEqual([...points].sort((a, b) => b - a));
    expect(result.features[0].id).toBe("payment.disputes");
  });

  it("carries the raw observation next to every point it awarded", () => {
    const result = assessFraud(inputs({ failedInvoices30d: 6 }));
    const invoice = result.features.find((f) => f.id === "payment.failed_invoices");
    expect(invoice?.evidence).toBe("6 sur 30 jours");
  });

  it("caps at 100 and lands in the critical band when everything fires", () => {
    const result = assessFraud({
      accountAgeDays: 0,
      maxAccountsPerIp: 10,
      distinctIps30d: 60,
      accountsSharingStripeCustomer: 4,
      emailDomain: "yopmail.com",
      signupsFromSameIp30d: 12,
      failedLogins24h: 40,
      disputes: 2,
      failedInvoices30d: 10,
      pastDueDays: 60,
      smallFailedCharges24h: 20,
      refundedCharges: 9,
      totalCharges: 10,
      distinctCountries7d: 9,
      maxImpliedSpeedKmh: 4000,
      cardCountry: "NG",
      visitCountry: "FR",
      distinctUserAgents30d: 30,
      botSessionSeen: true,
      hourDeviation: 12,
      tokensPurchased: true,
      projectCount: 0,
    });
    expect(result.score).toBe(100);
    expect(result.band).toBe("critical");
  });

  it("separates the bands at their stated thresholds", () => {
    // clean < 15 <= watch < 40 <= elevated < 70 <= critical
    expect(assessFraud(inputs({ emailDomain: "yopmail.com" })).score).toBe(10);
    expect(assessFraud(inputs({ emailDomain: "yopmail.com" })).band).toBe("clean");

    // 10 (disposable) + 10 (failed logins at the top of the ramp) = 20
    const watch = assessFraud(inputs({ emailDomain: "yopmail.com", failedLogins24h: 25 }));
    expect(watch.score).toBe(20);
    expect(watch.band).toBe("watch");

    // 30 (dispute) + 15 (shared customer) = 45
    const elevated = assessFraud(inputs({ disputes: 1, accountsSharingStripeCustomer: 2 }));
    expect(elevated.score).toBe(45);
    expect(elevated.band).toBe("elevated");

    // 30 + 25 + 18 = 73
    const critical = assessFraud(
      inputs({ disputes: 1, smallFailedCharges24h: 10, maxAccountsPerIp: 6 }),
    );
    expect(critical.score).toBe(73);
    expect(critical.band).toBe("critical");
  });
});
