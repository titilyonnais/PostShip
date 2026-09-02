export type Plan = "free" | "solo" | "team";

export const PLAN_LIMITS: Record<
  Plan,
  {
    projects: number;
    urls: number;
    intervalMinutes: number;
    chatWebhooks: boolean;
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
