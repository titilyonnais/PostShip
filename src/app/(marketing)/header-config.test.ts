import { describe, expect, it } from "vitest";
import { getHeaderConfig, SECTION_LINKS } from "./header-config";

describe("getHeaderConfig", () => {
  it("/ (logged out): Commencer -> /login?plan=free", () => {
    expect(getHeaderConfig("/", false).slot).toEqual({
      label: "Commencer",
      href: "/login?plan=free",
    });
  });

  it("/produit (logged out): Voir les tarifs -> /pricing", () => {
    expect(getHeaderConfig("/produit", false).slot).toEqual({
      label: "Voir les tarifs",
      href: "/pricing",
    });
  });

  it("/pricing (logged out): Prendre Solo -> /login?plan=solo", () => {
    expect(getHeaderConfig("/pricing", false).slot).toEqual({
      label: "Prendre Solo",
      href: "/login?plan=solo",
    });
  });

  it("/changelog (logged out): Voir le produit -> /produit", () => {
    expect(getHeaderConfig("/changelog", false).slot).toEqual({
      label: "Voir le produit",
      href: "/produit",
    });
  });

  it("/docs and /docs/* (logged out): Commencer -> /login?plan=free", () => {
    expect(getHeaderConfig("/docs", false).slot).toEqual({
      label: "Commencer",
      href: "/login?plan=free",
    });
    expect(getHeaderConfig("/docs/premier-projet", false).slot).toEqual({
      label: "Commencer",
      href: "/login?plan=free",
    });
  });

  it("/login: no slot at all, logged in or out", () => {
    expect(getHeaderConfig("/login", false).slot).toBeNull();
    expect(getHeaderConfig("/login", true).slot).toBeNull();
  });

  it("legal pages and unmapped routes: Accueil -> /", () => {
    expect(getHeaderConfig("/terms", false).slot).toEqual({ label: "Accueil", href: "/" });
    expect(getHeaderConfig("/cgv", false).slot).toEqual({ label: "Accueil", href: "/" });
    expect(getHeaderConfig("/privacy", true).slot).toEqual({ label: "Accueil", href: "/" });
  });

  it("logged in: every anonymous-CTA page collapses to Ouvrir l'app -> /app", () => {
    for (const pathname of ["/", "/produit", "/pricing", "/changelog", "/docs"]) {
      expect(getHeaderConfig(pathname, true).slot).toEqual({
        label: "Ouvrir l'app",
        href: "/app",
      });
    }
  });

  it("always returns the same 4 section links regardless of pathname", () => {
    for (const pathname of ["/", "/pricing", "/docs", "/login", "/terms"]) {
      expect(getHeaderConfig(pathname, false).links).toBe(SECTION_LINKS);
    }
    expect(SECTION_LINKS.map((l) => l.label)).toEqual([
      "Produit",
      "Tarifs",
      "Documentation",
      "Journal",
    ]);
  });
});
