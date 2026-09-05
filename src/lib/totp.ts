import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

// RFC 6238 TOTP, on node:crypto alone.
//
// Written here rather than pulled from npm because the operator console
// must not depend on a third-party package for the one check standing
// between the internet and total control of the site — an authenticator
// implementation is ~80 lines of well-specified arithmetic, and a
// dependency here is a supply-chain path straight into the admin login.

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; // RFC 4648 base32
export const STEP_SECONDS = 30;
export const DIGITS = 6;

export function generateTotpSecret(): string {
  // 20 bytes = 160 bits, the size RFC 4226 specifies for HMAC-SHA1 keys.
  const bytes = randomBytes(20);
  let bits = "";
  for (const byte of bytes) bits += byte.toString(2).padStart(8, "0");

  let secret = "";
  for (let i = 0; i + 5 <= bits.length; i += 5) {
    secret += ALPHABET[parseInt(bits.slice(i, i + 5), 2)];
  }
  return secret;
}

function base32Decode(secret: string): Buffer {
  const clean = secret.toUpperCase().replace(/=+$/, "").replace(/\s/g, "");
  let bits = "";
  for (const char of clean) {
    const index = ALPHABET.indexOf(char);
    if (index === -1) throw new Error("Secret TOTP invalide");
    bits += index.toString(2).padStart(5, "0");
  }

  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

export function currentStep(atMs: number = Date.now()): number {
  return Math.floor(atMs / 1000 / STEP_SECONDS);
}

function codeForStep(secret: string, step: number): string {
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(step));

  const digest = createHmac("sha1", base32Decode(secret)).update(counter).digest();
  // Dynamic truncation, RFC 4226 §5.4.
  const offset = digest[digest.length - 1] & 0x0f;
  const binary =
    ((digest[offset] & 0x7f) << 24) |
    ((digest[offset + 1] & 0xff) << 16) |
    ((digest[offset + 2] & 0xff) << 8) |
    (digest[offset + 3] & 0xff);

  return (binary % 10 ** DIGITS).toString().padStart(DIGITS, "0");
}

export type TotpVerification =
  | { ok: true; step: number }
  | { ok: false; reason: "format" | "mismatch" | "replay" };

// `lastStep` is the highest step already spent by this account. A code is
// valid for its whole 30-second window, so without refusing a step that
// has already been used, anyone who observes a code — shoulder-surfing, a
// proxy, a screenshot — can replay it until that window closes.
export function verifyTotp(
  secret: string,
  code: string,
  lastStep: number | null,
  atMs: number = Date.now(),
): TotpVerification {
  const cleaned = code.replace(/\D/g, "");
  if (cleaned.length !== DIGITS) return { ok: false, reason: "format" };

  const now = currentStep(atMs);
  // One step either side absorbs clock drift between the phone and us,
  // which is the tolerance RFC 6238 §5.2 recommends. Wider would multiply
  // the guessing surface for no practical gain.
  for (const step of [now, now - 1, now + 1]) {
    const expected = Buffer.from(codeForStep(secret, step));
    const given = Buffer.from(cleaned);
    if (expected.length !== given.length) continue;
    if (!timingSafeEqual(expected, given)) continue;

    if (lastStep !== null && step <= lastStep) return { ok: false, reason: "replay" };
    return { ok: true, step };
  }

  return { ok: false, reason: "mismatch" };
}

// otpauth:// URI for the QR code. The issuer appears twice on purpose:
// the label prefix is what older authenticators read, the parameter is
// what current ones do.
export function totpUri(secret: string, account: string, issuer = "PostShip Admin"): string {
  const label = encodeURIComponent(`${issuer}:${account}`);
  const params = new URLSearchParams({
    secret,
    issuer,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${params.toString()}`;
}
