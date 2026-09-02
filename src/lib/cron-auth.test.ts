import { afterEach, describe, expect, it, vi } from "vitest";
import { isAuthorizedCronRequest } from "./cron-auth";

function requestWithAuth(header: string | null): Request {
  const headers = new Headers();
  if (header !== null) headers.set("authorization", header);
  return new Request("https://postship.fr/api/cron/tick", { headers });
}

describe("isAuthorizedCronRequest", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("accepts the correct bearer secret", () => {
    vi.stubEnv("CRON_SECRET", "correct-horse-battery-staple");
    expect(isAuthorizedCronRequest(requestWithAuth("Bearer correct-horse-battery-staple"))).toBe(
      true,
    );
  });

  it("rejects a wrong secret", () => {
    vi.stubEnv("CRON_SECRET", "correct-horse-battery-staple");
    expect(isAuthorizedCronRequest(requestWithAuth("Bearer wrong"))).toBe(false);
  });

  it("rejects a missing header", () => {
    vi.stubEnv("CRON_SECRET", "correct-horse-battery-staple");
    expect(isAuthorizedCronRequest(requestWithAuth(null))).toBe(false);
  });

  // The bug this guards against: a bare `authHeader !== \`Bearer ${secret}\``
  // comparison against an unset env var only rejects requests that aren't
  // literally the string "Bearer undefined" — fail closed instead.
  it("rejects every request when CRON_SECRET is unset, even the literal 'Bearer undefined'", () => {
    vi.stubEnv("CRON_SECRET", undefined);
    expect(isAuthorizedCronRequest(requestWithAuth("Bearer undefined"))).toBe(false);
    expect(isAuthorizedCronRequest(requestWithAuth(null))).toBe(false);
  });
});
