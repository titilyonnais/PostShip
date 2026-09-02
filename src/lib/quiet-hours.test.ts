import { describe, expect, it } from "vitest";
import { isInQuietHours } from "./quiet-hours";

const PARIS = "Europe/Paris";

describe("isInQuietHours", () => {
  it("22->08, 23:30 Paris is inside the window", () => {
    // 2026-01-15 is CET (UTC+1): 22:30 UTC = 23:30 Paris.
    const now = new Date("2026-01-15T22:30:00.000Z");
    expect(isInQuietHours(now, 22, 8, PARIS)).toBe(true);
  });

  it("22->08, 10:00 Paris is outside the window", () => {
    const now = new Date("2026-01-15T09:00:00.000Z");
    expect(isInQuietHours(now, 22, 8, PARIS)).toBe(false);
  });

  it("start=end=null disables quiet hours", () => {
    const now = new Date("2026-01-15T22:30:00.000Z");
    expect(isInQuietHours(now, null, null, PARIS)).toBe(false);
  });

  it("start=9 end=18 (daytime window), 12:00 Paris is inside", () => {
    const now = new Date("2026-01-15T11:00:00.000Z");
    expect(isInQuietHours(now, 9, 18, PARIS)).toBe(true);
  });

  it("start=9 end=18 (daytime window), 20:00 Paris is outside", () => {
    const now = new Date("2026-01-15T19:00:00.000Z");
    expect(isInQuietHours(now, 9, 18, PARIS)).toBe(false);
  });
});
