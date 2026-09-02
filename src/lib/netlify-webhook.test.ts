import { createHash, createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { isValidNetlifySignature } from "./netlify-webhook";

function base64Url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function signNetlifyToken(rawBody: string, secret: string, iss = "netlify"): string {
  const header = base64Url(Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })));
  const payload = base64Url(
    Buffer.from(
      JSON.stringify({
        iss,
        sha256: createHash("sha256").update(rawBody).digest("hex"),
      }),
    ),
  );
  const signature = base64Url(
    createHmac("sha256", secret).update(`${header}.${payload}`).digest(),
  );
  return `${header}.${payload}.${signature}`;
}

describe("isValidNetlifySignature", () => {
  const secret = "netlify-webhook-secret";
  const body = JSON.stringify({ state: "ready" });

  it("accepts a correctly signed token", () => {
    const token = signNetlifyToken(body, secret);
    expect(isValidNetlifySignature(body, secret, token)).toBe(true);
  });

  it("rejects a token signed with the wrong secret", () => {
    const token = signNetlifyToken(body, "wrong-secret");
    expect(isValidNetlifySignature(body, secret, token)).toBe(false);
  });

  it("rejects a token whose body hash doesn't match the actual body", () => {
    const token = signNetlifyToken(body, secret);
    expect(isValidNetlifySignature('{"tampered":true}', secret, token)).toBe(false);
  });

  it("rejects a token with the wrong issuer", () => {
    const token = signNetlifyToken(body, secret, "someone-else");
    expect(isValidNetlifySignature(body, secret, token)).toBe(false);
  });

  it("rejects a missing token", () => {
    expect(isValidNetlifySignature(body, secret, null)).toBe(false);
  });

  it("rejects a malformed token", () => {
    expect(isValidNetlifySignature(body, secret, "not-a-jwt")).toBe(false);
  });
});
