import { describe, expect, it } from "vitest";
import { assertSameSiteHost, isSameOrSubdomainHost } from "./host-match";

describe("isSameOrSubdomainHost", () => {
  it("matches the exact same host", () => {
    expect(isSameOrSubdomainHost("example.com", "example.com")).toBe(true);
  });

  it("matches a subdomain of the base host", () => {
    expect(isSameOrSubdomainHost("www.example.com", "example.com")).toBe(true);
    expect(isSameOrSubdomainHost("app.example.com", "example.com")).toBe(true);
    expect(isSameOrSubdomainHost("a.b.example.com", "example.com")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isSameOrSubdomainHost("WWW.Example.com", "example.com")).toBe(true);
  });

  it("rejects an unrelated host", () => {
    expect(isSameOrSubdomainHost("evil.com", "example.com")).toBe(false);
  });

  it("rejects a host that merely ends with the same letters", () => {
    expect(isSameOrSubdomainHost("notexample.com", "example.com")).toBe(false);
  });

  it("rejects the base host being a subdomain of the target (reversed)", () => {
    expect(isSameOrSubdomainHost("example.com", "www.example.com")).toBe(false);
  });
});

describe("assertSameSiteHost", () => {
  it("allows a URL on the same host", () => {
    const result = assertSameSiteHost("https://example.com/checkout", "https://example.com");
    expect(result.ok).toBe(true);
  });

  it("allows a URL on a subdomain", () => {
    const result = assertSameSiteHost("https://app.example.com/checkout", "https://example.com");
    expect(result.ok).toBe(true);
  });

  it("refuses a URL on a different host with a clear message", () => {
    const result = assertSameSiteHost("https://evil.com/checkout", "https://example.com");
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toContain("example.com");
    }
  });

  it("refuses an invalid URL", () => {
    const result = assertSameSiteHost("not-a-url", "https://example.com");
    expect(result.ok).toBe(false);
  });
});
