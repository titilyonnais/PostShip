import { describe, expect, it } from "vitest";
import { detectSurfaceMutations, shouldAlertMutated, type PageSurface } from "./surface";

const BASE: PageSurface = {
  title: "Tarif — 29€/mois",
  h1: "Tarif — 29€/mois",
  description: "Passez à l'offre payante",
  ogTitle: "Tarif",
};

describe("detectSurfaceMutations", () => {
  it("returns nothing when there is no prior surface to compare against", () => {
    expect(detectSurfaceMutations(null, BASE)).toEqual([]);
  });

  it("returns nothing when nothing changed", () => {
    expect(detectSurfaceMutations(BASE, { ...BASE })).toEqual([]);
  });

  it("flags a field that went from non-empty to empty", () => {
    const after = { ...BASE, h1: null };
    const mutations = detectSurfaceMutations(BASE, after);
    expect(mutations).toEqual([{ field: "h1", before: BASE.h1, after: null }]);
  });

  it("flags a field that turned into a suspicious placeholder", () => {
    const after = { ...BASE, title: "Coming soon" };
    const mutations = detectSurfaceMutations(BASE, after);
    expect(mutations).toEqual([{ field: "title", before: BASE.title, after: "Coming soon" }]);
  });

  it("flags an error-5xx-looking title", () => {
    const after = { ...BASE, title: "Error 502" };
    const mutations = detectSurfaceMutations(BASE, after);
    expect(mutations).toHaveLength(1);
  });

  it("does not flag an ordinary title typo", () => {
    const after = { ...BASE, title: "Tarif — 29€/moi" };
    expect(detectSurfaceMutations(BASE, after)).toEqual([]);
  });

  it("does not flag a field that was already empty before", () => {
    const before = { ...BASE, description: null };
    const after = { ...BASE, description: null };
    expect(detectSurfaceMutations(before, after)).toEqual([]);
  });

  it("can flag more than one field at once", () => {
    const after = { ...BASE, h1: null, ogTitle: "under construction" };
    const mutations = detectSurfaceMutations(BASE, after);
    expect(mutations.map((m) => m.field).sort()).toEqual(["h1", "ogTitle"]);
  });
});

describe("shouldAlertMutated", () => {
  it("alerts on a deploy run when a field disappeared", () => {
    const after = { ...BASE, h1: null };
    expect(shouldAlertMutated(BASE, after, true)).toBe(true);
  });

  it("never alerts on a cron/manual run, even for the same mutation", () => {
    const after = { ...BASE, h1: null };
    expect(shouldAlertMutated(BASE, after, false)).toBe(false);
  });

  it("does not alert on a typo regardless of deploy status", () => {
    const after = { ...BASE, title: "Tarif — 29€/moi" };
    expect(shouldAlertMutated(BASE, after, true)).toBe(false);
  });
});
