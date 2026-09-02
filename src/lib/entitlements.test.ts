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
    chatWebhooks: false,
    deployHooks: false,
    stripeHealth: false,
    teamMembers: false,
    retentionDays: 7,
    digest: false,
  },
  solo: {
    projects: 3,
    urls: 15,
    intervalMinutes: 5,
    chatWebhooks: true,
    deployHooks: true,
    stripeHealth: false,
    teamMembers: false,
    retentionDays: 14,
    digest: true,
  },
  team: {
    projects: 10,
    urls: 50,
    intervalMinutes: 5,
    chatWebhooks: true,
    deployHooks: true,
    stripeHealth: true,
    teamMembers: true,
    retentionDays: 30,
    digest: true,
  },
};

describe("getPlanLimits", () => {
  for (const plan of Object.keys(DOCUMENTED_LIMITS) as Plan[]) {
    it(`matches the documented ${plan} plan limits`, () => {
      expect(getPlanLimits(plan)).toEqual(DOCUMENTED_LIMITS[plan]);
    });
  }

  it("only grants chat webhooks/deploy-hooks/Stripe-health to paying plans", () => {
    expect(getPlanLimits("free").chatWebhooks).toBe(false);
    expect(getPlanLimits("free").deployHooks).toBe(false);
    expect(getPlanLimits("free").stripeHealth).toBe(false);
  });

  it("only grants Stripe health/team members to Team", () => {
    expect(getPlanLimits("free").stripeHealth).toBe(false);
    expect(getPlanLimits("solo").stripeHealth).toBe(false);
    expect(getPlanLimits("team").stripeHealth).toBe(true);
    expect(getPlanLimits("free").teamMembers).toBe(false);
    expect(getPlanLimits("solo").teamMembers).toBe(false);
    expect(getPlanLimits("team").teamMembers).toBe(true);
  });

  it("keeps the 5-minute interval promise for paid plans", () => {
    expect(getPlanLimits("solo").intervalMinutes).toBe(5);
    expect(getPlanLimits("team").intervalMinutes).toBe(5);
  });
});
