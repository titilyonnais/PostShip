import { describe, expect, it } from "vitest";
import { buildAlertCopy, type AlertCopyItem } from "./alert-copy";

function failItem(overrides: Partial<AlertCopyItem> = {}): AlertCopyItem {
  return {
    url: "https://example.com/",
    kind: "fail",
    outcome: "fail",
    httpStatus: 500,
    ...overrides,
  };
}

describe("buildAlertCopy", () => {
  it("describes a broken asset", () => {
    const copy = buildAlertCopy("Acme", [
      failItem({ missing: ["asset:404:/_next/static/app.js"] }),
    ]);
    expect(copy.text).toContain(
      "La page répond 200 mais un fichier statique est introuvable : /_next/static/app.js.",
    );
  });

  it("describes a missing Stripe.js", () => {
    const copy = buildAlertCopy("Acme", [
      failItem({ url: "https://example.com/checkout", missing: ["stripe_js"] }),
    ]);
    expect(copy.text).toContain("Stripe.js n'est plus chargé sur https://example.com/checkout.");
  });

  it("describes a missing login form", () => {
    const copy = buildAlertCopy("Acme", [
      failItem({ url: "https://example.com/login", missing: ["login_form"] }),
    ]);
    expect(copy.text).toContain(
      "Le formulaire de connexion est introuvable sur https://example.com/login.",
    );
  });

  it("describes a missing price token", () => {
    const copy = buildAlertCopy("Acme", [
      failItem({ url: "https://example.com/pricing", missing: ["price_token"] }),
    ]);
    expect(copy.text).toContain("Le prix n'apparaît plus sur https://example.com/pricing.");
  });

  it("describes a broken social card image", () => {
    const copy = buildAlertCopy("Acme", [failItem({ missing: ["og:image"] })]);
    expect(copy.text).toContain("La carte sociale n'a plus d'image valide.");
  });

  it("falls back to a plain status line", () => {
    const copy = buildAlertCopy("Acme", [failItem({ httpStatus: 503, missing: [] })]);
    expect(copy.text).toContain("https://example.com/ répond 503.");
  });

  it("describes a recovered item", () => {
    const copy = buildAlertCopy("Acme", [
      { url: "https://example.com/", kind: "recovered", outcome: "pass", httpStatus: 200 },
    ]);
    expect(copy.text).toContain("Rétabli — https://example.com/");
  });

  it("includes the recap line with counts", () => {
    const copy = buildAlertCopy("Acme", [
      failItem(),
      { url: "https://example.com/b", kind: "recovered", outcome: "pass", httpStatus: 200 },
    ]);
    expect(copy.text.split("\n")[0]).toBe("1 en échec, 1 rétablis.");
  });

  it("prefixes the recap with the deploy hint when present", () => {
    const copy = buildAlertCopy("Acme", [
      failItem({ deployHint: "deploy Vercel 23:12" }),
    ]);
    expect(copy.text.split("\n")[0]).toBe(
      "Depuis le dernier déploiement : 1 en échec, 0 rétablis.",
    );
  });

  it("builds a subject naming the failure count when there's a failure", () => {
    const copy = buildAlertCopy("Acme", [failItem(), failItem()]);
    expect(copy.subject).toBe("[PostShip] Acme — 2 URL(s) en échec");
  });

  it("builds a subject naming the recovery count when everything recovered", () => {
    const copy = buildAlertCopy("Acme", [
      { url: "https://example.com/", kind: "recovered", outcome: "pass", httpStatus: 200 },
    ]);
    expect(copy.subject).toBe("[PostShip] Acme — 1 URL(s) rétabli");
  });
});
