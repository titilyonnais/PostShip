// Shared, in-memory-only counter for one cron tick invocation — a single
// tick can cover many projects' worth of checks plus site-scan pages, and
// without a ceiling a pathological due-project count (or a slow/huge scan)
// can make a single invocation issue an unbounded number of outbound
// requests. Not persisted anywhere; a fresh budget is created per
// invocation in src/app/api/cron/tick/route.ts and threaded down through
// runProjectChecks / advanceSiteScans / guardedFetch. Manual, user-
// triggered runs (runProjectNow, runTargetNow, "Lancer maintenant") never
// receive a budget, so they stay unbounded — see the callers.
export const MAX_FETCHES_PER_TICK = 200;

export type FetchBudget = { remaining: number };

export const BUDGET_EXHAUSTED_MESSAGE =
  "Budget tick atteint, reporté au prochain passage.";

export function createFetchBudget(max: number = MAX_FETCHES_PER_TICK): FetchBudget {
  return { remaining: max };
}

// Returns false — without decrementing — when the budget is already
// exhausted; the caller must not perform the fetch/request it was about
// to make. A missing budget (undefined) means "unbounded," not "exhausted."
export function tryConsumeBudget(budget: FetchBudget | undefined): boolean {
  if (!budget) return true;
  if (budget.remaining <= 0) return false;
  budget.remaining -= 1;
  return true;
}
