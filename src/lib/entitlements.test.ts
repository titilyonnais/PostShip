import { describe, expect, it } from "vitest";
import { getPlanLimits, PLAN_LIMITS, type Plan } from "./entitlements";

// Mirrors the pricing table documented in CLAUDE.md exactly — this table is
// the single source of truth for gating (settings pages, the cron runner's
// interval selection, project/URL quotas), so a silent drift here is a
// silent product-limits bug, not just a docs mismatch.
const DOCUMENTED_LIMITS: Record<Plan, (typeof PLAN_LIMITS)[Plan]> = {
  free: {
    projects: 1,
    urls: 3,
    intervalMinutes: 30,
    discord: false,
    vercelHook: false,
    stripeHealth: false,
    retentionDays: 7,
  },
  solo: {
    projects: 3,
    urls: 15,
    intervalMinutes: 5,
    discord: true,
    vercelHook: true,
    stripeHealth: false,
    retentionDays: 14,
  },
  team: {
    projects: 10,
    urls: 50,
    intervalMinutes: 5,
    discord: true,
    vercelHook: true,
    stripeHealth: true,
    retentionDays: 30,
  },
};

describe("getPlanLimits", () => {
  for (const plan of Object.keys(DOCUMENTED_LIMITS) as Plan[]) {
    it(`matches the documented ${plan} plan limits`, () => {
      expect(getPlanLimits(plan)).toEqual(DOCUMENTED_LIMITS[plan]);
    });
  }

  it("only grants Discord/Vercel-hook/Stripe-health to paying plans", () => {
    expect(getPlanLimits("free").discord).toBe(false);
    expect(getPlanLimits("free").vercelHook).toBe(false);
    expect(getPlanLimits("free").stripeHealth).toBe(false);
  });

  it("only grants Stripe health to Team", () => {
    expect(getPlanLimits("free").stripeHealth).toBe(false);
    expect(getPlanLimits("solo").stripeHealth).toBe(false);
    expect(getPlanLimits("team").stripeHealth).toBe(true);
  });

  it("keeps the 5-minute interval promise for paid plans", () => {
    expect(getPlanLimits("solo").intervalMinutes).toBe(5);
    expect(getPlanLimits("team").intervalMinutes).toBe(5);
  });
});
