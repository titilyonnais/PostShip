// "team" is the internal plan value used in the database, Stripe
// (planFromPriceId, webhooks) and here — the UI displays it as "Pro"
// (see PLAN_LABEL in src/lib/pricing.ts). teamMembers gates per-project
// collaborators (invite-by-email on a single project, no billing/other
// projects access), not multi-seat org membership — there's no seats model.
export type Plan = "free" | "solo" | "team";

export const PLAN_LIMITS: Record<
  Plan,
  {
    projects: number;
    urls: number;
    intervalMinutes: number;
    chatWebhooks: boolean; // gates Discord, Slack, and Telegram alike
    deployHooks: boolean;
    stripeHealth: boolean;
    teamMembers: boolean;
    retentionDays: number;
  }
> = {
  free: {
    projects: 1,
    urls: 3,
    intervalMinutes: 30,
    chatWebhooks: false,
    deployHooks: false,
    stripeHealth: false,
    teamMembers: false,
    retentionDays: 7,
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
  },
};

export function getPlanLimits(plan: Plan) {
  return PLAN_LIMITS[plan];
}
