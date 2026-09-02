import { describe, expect, it } from "vitest";
import { getReliability } from "./reliability";

function fakeSupabase(tables: Record<string, unknown[]>) {
  return {
    from(table: string) {
      const rows = tables[table] ?? [];
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        gte: () => builder,
        order: () => builder,
        then: (resolve: (v: { data: unknown[] }) => unknown) =>
          resolve({ data: rows }),
      };
      return builder;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;

describe("getReliability", () => {
  it("mttr: a fail followed by a recover 12 minutes later is 12", async () => {
    const failAt = new Date(Date.now() - HOUR_MS);
    const recoveredAt = new Date(failAt.getTime() + 12 * MIN_MS);
    const supabase = fakeSupabase({
      check_runs: [],
      alert_events: [
        { target_id: "t1", kind: "fail", sent_at: failAt.toISOString() },
        { target_id: "t1", kind: "recovered", sent_at: recoveredAt.toISOString() },
      ],
    });

    const result = await getReliability(supabase, "p1");
    expect(result.mttrMinutes).toBe(12);
    expect(result.incidents30d).toBe(1);
  });

  it("mttr: a fail with no recover is excluded (null when it's the only cycle)", async () => {
    const supabase = fakeSupabase({
      check_runs: [],
      alert_events: [
        { target_id: "t1", kind: "fail", sent_at: new Date().toISOString() },
      ],
    });

    const result = await getReliability(supabase, "p1");
    expect(result.mttrMinutes).toBeNull();
    expect(result.incidents30d).toBe(1);
  });

  it("mttr: two closed cycles of 10 and 30 minutes median to 20", async () => {
    const base = Date.now() - 2 * HOUR_MS;
    const supabase = fakeSupabase({
      check_runs: [],
      alert_events: [
        { target_id: "t1", kind: "fail", sent_at: new Date(base).toISOString() },
        {
          target_id: "t1",
          kind: "recovered",
          sent_at: new Date(base + 10 * MIN_MS).toISOString(),
        },
        {
          target_id: "t2",
          kind: "fail",
          sent_at: new Date(base + 20 * MIN_MS).toISOString(),
        },
        {
          target_id: "t2",
          kind: "recovered",
          sent_at: new Date(base + 50 * MIN_MS).toISOString(),
        },
      ],
    });

    const result = await getReliability(supabase, "p1");
    expect(result.mttrMinutes).toBe(20);
    expect(result.incidents30d).toBe(2);
  });

  it("heatmap buckets runs by UTC day and marks fail/error as failRuns", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const supabase = fakeSupabase({
      check_runs: [
        { started_at: `${today}T01:00:00.000Z`, outcome: "pass" },
        { started_at: `${today}T02:00:00.000Z`, outcome: "fail" },
        { started_at: `${today}T03:00:00.000Z`, outcome: "error" },
      ],
      alert_events: [],
    });

    const result = await getReliability(supabase, "p1");
    expect(result.heatmap).toHaveLength(30);
    const todayBucket = result.heatmap.find((d) => d.date === today);
    expect(todayBucket).toEqual({ date: today, failRuns: 2, totalRuns: 3 });
    expect(result.mttrMinutes).toBeNull();
    expect(result.incidents30d).toBe(0);
  });
});
