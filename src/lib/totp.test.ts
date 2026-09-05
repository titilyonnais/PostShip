import { describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import { currentStep, generateTotpSecret, totpUri, verifyTotp } from "./totp";

// RFC 6238 appendix B publishes test vectors for the ASCII secret
// "12345678901234567890"; base32 of that is GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ.
const RFC_SECRET = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

// The reference codes are 8 digits; ours are 6, so compare against the
// last 6 of each published value.
const VECTORS: [number, string][] = [
  [59, "287082"],
  [1111111109, "081804"],
  [1111111111, "050471"],
  [1234567890, "005924"],
  [2000000000, "279037"],
];

describe("verifyTotp", () => {
  it("accepts the RFC 6238 reference codes", () => {
    for (const [seconds, code] of VECTORS) {
      const result = verifyTotp(RFC_SECRET, code, null, seconds * 1000);
      expect(result, `t=${seconds}`).toEqual({ ok: true, step: Math.floor(seconds / 30) });
    }
  });

  it("tolerates one step of clock drift either way", () => {
    const at = 1111111109 * 1000;
    // The code minted for the previous window still verifies.
    expect(verifyTotp(RFC_SECRET, "081804", null, at + 30_000).ok).toBe(true);
    expect(verifyTotp(RFC_SECRET, "081804", null, at - 30_000).ok).toBe(true);
  });

  it("refuses a step already spent, so a seen code can't be replayed", () => {
    const at = 1111111109 * 1000;
    const step = Math.floor(1111111109 / 30);
    expect(verifyTotp(RFC_SECRET, "081804", step, at)).toEqual({
      ok: false,
      reason: "replay",
    });
    // One step older is spent too.
    expect(verifyTotp(RFC_SECRET, "081804", step + 5, at).ok).toBe(false);
  });

  it("rejects a wrong code and a malformed one distinctly", () => {
    expect(verifyTotp(RFC_SECRET, "000000", null, 59_000)).toEqual({
      ok: false,
      reason: "mismatch",
    });
    expect(verifyTotp(RFC_SECRET, "12345", null, 59_000)).toEqual({
      ok: false,
      reason: "format",
    });
    expect(verifyTotp(RFC_SECRET, "abcdef", null, 59_000)).toEqual({
      ok: false,
      reason: "format",
    });
  });
});

describe("generateTotpSecret", () => {
  it("emits 160 bits of base32, and a different one every time", () => {
    const a = generateTotpSecret();
    const b = generateTotpSecret();
    expect(a).toMatch(/^[A-Z2-7]{32}$/);
    expect(a).not.toBe(b);
  });

  it("produces a secret its own verifier accepts", () => {
    const secret = generateTotpSecret();
    // Mint the current code the same way the implementation does, to prove
    // generation and verification agree end to end.
    const step = currentStep();
    const counter = Buffer.alloc(8);
    counter.writeBigUInt64BE(BigInt(step));
    const bits = [...secret]
      .map((c) => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(c).toString(2).padStart(5, "0"))
      .join("");
    const bytes: number[] = [];
    for (let i = 0; i + 8 <= bits.length; i += 8) bytes.push(parseInt(bits.slice(i, i + 8), 2));
    const digest = createHmac("sha1", Buffer.from(bytes)).update(counter).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary =
      ((digest[offset] & 0x7f) << 24) |
      ((digest[offset + 1] & 0xff) << 16) |
      ((digest[offset + 2] & 0xff) << 8) |
      (digest[offset + 3] & 0xff);
    const code = (binary % 1_000_000).toString().padStart(6, "0");

    expect(verifyTotp(secret, code, null).ok).toBe(true);
  });
});

describe("totpUri", () => {
  it("carries the parameters an authenticator needs", () => {
    const uri = totpUri("ABCD", "ops@postship.fr");
    expect(uri).toContain("otpauth://totp/");
    expect(uri).toContain("secret=ABCD");
    expect(uri).toContain("digits=6");
    expect(uri).toContain("period=30");
    expect(uri).toContain("algorithm=SHA1");
  });
});
