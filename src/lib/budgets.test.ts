import { describe, expect, it } from "vitest";
import { createFetchBudget, tryConsumeBudget } from "./budgets";

describe("tryConsumeBudget", () => {
  it("is unbounded when no budget is given", () => {
    for (let i = 0; i < 1000; i++) {
      expect(tryConsumeBudget(undefined)).toBe(true);
    }
  });

  it("allows exactly `max` consumptions then refuses", () => {
    const budget = createFetchBudget(3);
    expect(tryConsumeBudget(budget)).toBe(true);
    expect(tryConsumeBudget(budget)).toBe(true);
    expect(tryConsumeBudget(budget)).toBe(true);
    expect(tryConsumeBudget(budget)).toBe(false);
    expect(tryConsumeBudget(budget)).toBe(false);
  });

  it("does not decrement further once exhausted", () => {
    const budget = createFetchBudget(1);
    expect(tryConsumeBudget(budget)).toBe(true);
    expect(budget.remaining).toBe(0);
    tryConsumeBudget(budget);
    tryConsumeBudget(budget);
    expect(budget.remaining).toBe(0);
  });

  it("defaults to MAX_FETCHES_PER_TICK when no max is given", () => {
    const budget = createFetchBudget();
    expect(budget.remaining).toBe(200);
  });
});
