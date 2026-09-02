import { describe, expect, it } from "vitest";
import { diffDeploySnapshots } from "./deploy-diff";

describe("diffDeploySnapshots", () => {
  it("flags a target that went pass -> fail as addedFails", () => {
    const previous = [{ targetId: "t1", url: "https://a.com", outcome: "pass" as const }];
    const current = [{ targetId: "t1", url: "https://a.com", outcome: "fail" as const }];

    const diff = diffDeploySnapshots(previous, current);
    expect(diff.addedFails).toEqual(current);
    expect(diff.recovered).toEqual([]);
  });

  it("flags a target that went fail -> pass as recovered", () => {
    const previous = [{ targetId: "t1", url: "https://a.com", outcome: "fail" as const }];
    const current = [{ targetId: "t1", url: "https://a.com", outcome: "pass" as const }];

    const diff = diffDeploySnapshots(previous, current);
    expect(diff.recovered).toEqual(current);
    expect(diff.addedFails).toEqual([]);
  });

  it("a target failing in both snapshots is neither addedFails nor recovered", () => {
    const previous = [{ targetId: "t1", url: "https://a.com", outcome: "fail" as const }];
    const current = [{ targetId: "t1", url: "https://a.com", outcome: "error" as const }];

    const diff = diffDeploySnapshots(previous, current);
    expect(diff.addedFails).toEqual([]);
    expect(diff.recovered).toEqual([]);
  });

  it("a target with no prior snapshot entry counts as newly failing, not recovered", () => {
    const current = [{ targetId: "t2", url: "https://b.com", outcome: "fail" as const }];

    const diff = diffDeploySnapshots([], current);
    expect(diff.addedFails).toEqual(current);
    expect(diff.recovered).toEqual([]);
  });
});
