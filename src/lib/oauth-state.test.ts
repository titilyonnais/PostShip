import { describe, expect, it, vi } from "vitest";
import { signOAuthState, verifyOAuthState } from "./oauth-state";

vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key-not-real");

describe("oauth-state", () => {
  it("round-trips a signed state", () => {
    const payload = { projectId: "p1", userId: "u1", ts: Date.now() };
    const token = signOAuthState(payload);
    expect(verifyOAuthState(token)).toEqual(payload);
  });

  it("rejects a tampered payload", () => {
    const token = signOAuthState({ projectId: "p1", userId: "u1", ts: Date.now() });
    const [, sig] = token.split(".");
    const tamperedBody = Buffer.from(
      JSON.stringify({ projectId: "attacker-project", userId: "u1", ts: Date.now() }),
    ).toString("base64url");
    expect(verifyOAuthState(`${tamperedBody}.${sig}`)).toBeNull();
  });

  it("rejects a tampered signature", () => {
    const token = signOAuthState({ projectId: "p1", userId: "u1", ts: Date.now() });
    const [body] = token.split(".");
    expect(verifyOAuthState(`${body}.deadbeef`)).toBeNull();
  });

  it("rejects an expired state", () => {
    const token = signOAuthState({
      projectId: "p1",
      userId: "u1",
      ts: Date.now() - 11 * 60 * 1000,
    });
    expect(verifyOAuthState(token)).toBeNull();
  });

  it("rejects malformed input", () => {
    expect(verifyOAuthState(null)).toBeNull();
    expect(verifyOAuthState("")).toBeNull();
    expect(verifyOAuthState("not-a-token")).toBeNull();
    expect(verifyOAuthState("a.b.c")).toBeNull();
  });
});
