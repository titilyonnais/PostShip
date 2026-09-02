import { describe, expect, it, vi } from "vitest";
import { parseBotCommand, runBotCommand } from "./bot-commands";

vi.mock("./runner", () => ({
  runProjectChecks: vi.fn().mockResolvedValue([]),
}));

function fakeSupabase(overrides: Record<string, unknown> = {}, updates: unknown[] = []) {
  const defaults: Record<string, unknown> = {
    check_targets: [
      { url: "https://example.com/", last_outcome: "pass" },
      { url: "https://example.com/pricing", last_outcome: "fail" },
    ],
    check_runs: [],
    projects: { last_checked_at: null },
    ...overrides,
  };

  return {
    from(table: string) {
      const rows = defaults[table];
      const builder = {
        select: () => builder,
        eq: () => builder,
        in: () => builder,
        order: () => builder,
        limit: () => builder,
        update: (data: unknown) => {
          updates.push(data);
          return builder;
        },
        maybeSingle: async () => ({ data: Array.isArray(rows) ? rows[0] : rows }),
        single: async () => ({ data: Array.isArray(rows) ? rows[0] : rows }),
        then: (resolve: (v: { data: unknown }) => unknown) =>
          resolve({ data: rows }),
      };
      return builder;
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any;
}

describe("parseBotCommand", () => {
  it("recognizes each known command", () => {
    expect(parseBotCommand("/status")).toBe("/status");
    expect(parseBotCommand("/check")).toBe("/check");
    expect(parseBotCommand("/uptime")).toBe("/uptime");
    expect(parseBotCommand("/ssl")).toBe("/ssl");
    expect(parseBotCommand("/silence")).toBe("/silence");
    expect(parseBotCommand("/help")).toBe("/help");
  });

  it("falls back to /help for anything else", () => {
    expect(parseBotCommand("hello")).toBe("/help");
    expect(parseBotCommand("/unknown")).toBe("/help");
    expect(parseBotCommand("")).toBe("/help");
  });

  it("strips the @BotName suffix Telegram appends in group chats", () => {
    expect(parseBotCommand("/status@MonBot")).toBe("/status");
    expect(parseBotCommand("/check@MonBot arg")).toBe("/check");
  });
});

describe("runBotCommand", () => {
  it("/status summarizes pass/fail counts and lists failing URLs", async () => {
    const supabase = fakeSupabase();
    const text = await runBotCommand("/status", { supabase, projectId: "p1" });
    expect(text).toContain("2 URL · 1 OK · 1 en échec");
    expect(text).toContain("https://example.com/pricing");
  });

  it("/help lists every command", async () => {
    const supabase = fakeSupabase();
    const text = await runBotCommand("/help", { supabase, projectId: "p1" });
    expect(text).toContain("/status");
    expect(text).toContain("/check");
    expect(text).toContain("/uptime");
    expect(text).toContain("/ssl");
    expect(text).toContain("/help");
  });

  it("/ssl reports no check when there's no ssl target", async () => {
    const supabase = fakeSupabase({ check_targets: [] });
    const text = await runBotCommand("/ssl", { supabase, projectId: "p1" });
    expect(text).toBe("pas de check SSL");
  });

  it("/silence 1h sets alerts_silenced_until in the future", async () => {
    const updates: unknown[] = [];
    const supabase = fakeSupabase({}, updates);
    const before = Date.now();
    const text = await runBotCommand(
      "/silence",
      { supabase, projectId: "p1" },
      "/silence 1h",
    );
    expect(text).toBe("Alertes coupées pour 1h.");
    expect(updates).toHaveLength(1);
    const until = new Date((updates[0] as { alerts_silenced_until: string }).alerts_silenced_until);
    expect(until.getTime()).toBeGreaterThan(before);
    expect(until.getTime()).toBeLessThanOrEqual(before + 61 * 60 * 1000);
  });

  it("/silence off resumes alerts (clears the column)", async () => {
    const updates: unknown[] = [];
    const supabase = fakeSupabase({}, updates);
    const text = await runBotCommand(
      "/silence",
      { supabase, projectId: "p1" },
      "/silence off",
    );
    expect(text).toBe("Alertes reprises.");
    expect(updates).toEqual([{ alerts_silenced_until: null }]);
  });
});
