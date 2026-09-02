import { describe, expect, it } from "vitest";
import { sanitizeNext } from "./route";

describe("sanitizeNext", () => {
  it("allows a plain /onboarding path", () => {
    expect(sanitizeNext("/onboarding")).toBe("/onboarding");
  });

  it("allows /onboarding with a query string", () => {
    expect(sanitizeNext("/onboarding?plan=solo")).toBe("/onboarding?plan=solo");
  });

  it("allows /app, /accept-terms, /login", () => {
    expect(sanitizeNext("/app")).toBe("/app");
    expect(sanitizeNext("/accept-terms")).toBe("/accept-terms");
    expect(sanitizeNext("/login")).toBe("/login");
  });

  it("falls back to /onboarding when next is missing", () => {
    expect(sanitizeNext(null)).toBe("/onboarding");
  });

  it("rejects an absolute URL disguised as a next param", () => {
    expect(sanitizeNext("https://evil.test")).toBe("/onboarding");
    expect(sanitizeNext("http://evil.test")).toBe("/onboarding");
  });

  it("rejects a protocol-relative URL", () => {
    expect(sanitizeNext("//evil.test")).toBe("/onboarding");
  });

  it("rejects a backslash-based open redirect", () => {
    expect(sanitizeNext("/\\evil.test")).toBe("/onboarding");
  });

  it("rejects a path outside the allowlist", () => {
    expect(sanitizeNext("/api/stripe/webhook")).toBe("/onboarding");
    expect(sanitizeNext("/")).toBe("/onboarding");
  });

  it("rejects a scheme smuggled into a relative-looking path", () => {
    expect(sanitizeNext("/https://evil.test")).toBe("/onboarding");
  });
});
