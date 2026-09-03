import { describe, expect, it } from "vitest";
import { getProjectBarSpec } from "./bar-config";

function actionIds(pathname: string): string[] {
  return getProjectBarSpec(pathname).actions.map((a) => a.id);
}

describe("getProjectBarSpec", () => {
  it("project root -> Aperçu, runNow", () => {
    const spec = getProjectBarSpec("/app/p1");
    expect(spec.title).toBe("Aperçu");
    expect(actionIds("/app/p1")).toEqual(["runNow"]);
  });

  it("deploys -> Déplois, runNow", () => {
    const spec = getProjectBarSpec("/app/p1/deploys");
    expect(spec.title).toBe("Déplois");
    expect(actionIds("/app/p1/deploys")).toEqual(["runNow"]);
  });

  it("incidents -> Incidents, silence1h", () => {
    const spec = getProjectBarSpec("/app/p1/incidents");
    expect(spec.title).toBe("Incidents");
    expect(actionIds("/app/p1/incidents")).toEqual(["silence1h"]);
  });

  it("urls -> URLs, addUrl", () => {
    const spec = getProjectBarSpec("/app/p1/urls");
    expect(spec.title).toBe("URLs");
    expect(actionIds("/app/p1/urls")).toEqual(["addUrl"]);
  });

  it("health -> Santé, recomputeHealth", () => {
    const spec = getProjectBarSpec("/app/p1/health");
    expect(spec.title).toBe("Santé");
    expect(actionIds("/app/p1/health")).toEqual(["recomputeHealth"]);
  });

  it("share -> Partage, copyStatus", () => {
    const spec = getProjectBarSpec("/app/p1/share");
    expect(spec.title).toBe("Partage");
    expect(actionIds("/app/p1/share")).toEqual(["copyStatus"]);
  });

  it("scans / integrations / settings -> no actions", () => {
    expect(actionIds("/app/p1/scans")).toEqual([]);
    expect(actionIds("/app/p1/integrations")).toEqual([]);
    expect(actionIds("/app/p1/settings")).toEqual([]);
    expect(getProjectBarSpec("/app/p1/scans").title).toBe("Scans");
    expect(getProjectBarSpec("/app/p1/integrations").title).toBe("Intégrations");
    expect(getProjectBarSpec("/app/p1/settings").title).toBe("Paramètres");
  });

  it("an unrecognized segment is a target-detail page -> URL, runTargetNow", () => {
    const spec = getProjectBarSpec("/app/p1/9f2c1a-target-uuid");
    expect(spec.title).toBe("URL");
    expect(actionIds("/app/p1/9f2c1a-target-uuid")).toEqual(["runNow"]);
    expect(spec.actions[0].action).toBe("runTargetNow");
  });

  it("is stable across different project ids for the same segment", () => {
    expect(getProjectBarSpec("/app/aaa/incidents")).toEqual(
      getProjectBarSpec("/app/bbb/incidents"),
    );
  });
});
