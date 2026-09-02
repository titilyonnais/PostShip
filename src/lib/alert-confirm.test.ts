import { describe, expect, it } from "vitest";
import {
  nextConsecutiveFails,
  shouldAlertFail,
  shouldAlertRecovered,
} from "./alert-confirm";

describe("nextConsecutiveFails", () => {
  it("resets to 0 on pass", () => {
    expect(nextConsecutiveFails("pass", 5)).toBe(0);
  });

  it("increments on fail", () => {
    expect(nextConsecutiveFails("fail", 2)).toBe(3);
  });

  it("increments on error", () => {
    expect(nextConsecutiveFails("error", 0)).toBe(1);
  });
});

describe("shouldAlertFail", () => {
  it("default confirm=1 alerts on the very first fail (backward compatible)", () => {
    expect(shouldAlertFail(1, 1)).toBe(true);
  });

  it("confirm=3 does not alert on the first or second fail", () => {
    expect(shouldAlertFail(1, 3)).toBe(false);
    expect(shouldAlertFail(2, 3)).toBe(false);
  });

  it("confirm=3 alerts once the streak reaches 3", () => {
    expect(shouldAlertFail(3, 3)).toBe(true);
    expect(shouldAlertFail(4, 3)).toBe(true);
  });
});

describe("shouldAlertRecovered", () => {
  it("fires when the fail streak had reached the confirm threshold", () => {
    // confirm=1: any fail was alerted, so recovering from it should alert.
    expect(shouldAlertRecovered("fail", 1, 1)).toBe(true);
  });

  it("does not fire a phantom recovered when confirm=3 and only 1 fail happened", () => {
    expect(shouldAlertRecovered("fail", 1, 3)).toBe(false);
  });

  it("fires when confirm=3 and the streak actually reached 3 before recovering", () => {
    expect(shouldAlertRecovered("fail", 3, 3)).toBe(true);
  });

  it("does not fire when there was no previous non-pass outcome", () => {
    expect(shouldAlertRecovered(null, 0, 1)).toBe(false);
    expect(shouldAlertRecovered("pass", 0, 1)).toBe(false);
  });
});
