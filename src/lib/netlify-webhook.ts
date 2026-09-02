import { createHash, createHmac, timingSafeEqual } from "node:crypto";

function base64UrlDecode(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function base64UrlEncode(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

// Netlify signs deploy-notification webhooks as a compact JWS (HS256): the
// `iss` claim identifies Netlify as the source and `sha256` is the hex
// SHA-256 of the raw request body — both are checked, not just the
// signature over the JWT's own header+payload.
// https://docs.netlify.com/deploy/deploy-notifications/
export function isValidNetlifySignature(
  rawBody: string,
  secret: string,
  token: string | null,
): boolean {
  if (!token) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;
  const [headerB64, payloadB64, signatureB64] = parts;

  const expectedSig = base64UrlEncode(
    createHmac("sha256", secret).update(`${headerB64}.${payloadB64}`).digest(),
  );
  const provided = Buffer.from(signatureB64);
  const expected = Buffer.from(expectedSig);
  if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
    return false;
  }

  let payload: { iss?: string; sha256?: string };
  try {
    payload = JSON.parse(base64UrlDecode(payloadB64).toString("utf-8"));
  } catch {
    return false;
  }

  if (payload.iss !== "netlify") return false;

  const bodyHash = createHash("sha256").update(rawBody).digest("hex");
  return payload.sha256 === bodyHash;
}
