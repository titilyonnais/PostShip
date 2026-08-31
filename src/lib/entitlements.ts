export type Plan = "free" | "solo" | "team";

export const PLAN_LIMITS: Record<
  Plan,
  {
    projects: number;
    urls: number;
    intervalMinutes: number;
    discord: boolean;
    vercelHook: boolean;
    stripeHealth: boolean;
    retentionDays: number;
  }
> = {
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

export function getPlanLimits(plan: Plan) {
  return PLAN_LIMITS[plan];
}
