import { createHmac, timingSafeEqual } from "node:crypto";

// Signs the `state` param round-tripped through Discord/Slack's OAuth
// screens (src/app/api/oauth/*) — binds it to the project and the user who
// started the flow, and expires it, without needing a DB row for a value
// that only ever lives for the few seconds of a redirect round-trip.
// Keyed off the service-role key (already a strong, always-present
// secret) rather than asking for yet another env var just for this.
const STATE_TTL_MS = 10 * 60 * 1000;

export type OAuthState = { projectId: string; userId: string; ts: number };

function stateSecret(): string {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) throw new Error("SUPABASE_SERVICE_ROLE_KEY not configured");
  return secret;
}

export function signOAuthState(payload: OAuthState): string {
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyOAuthState(token: string | null): OAuthState | null {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;

  const expected = createHmac("sha256", stateSecret()).update(body).digest("base64url");
  const sigBuf = Buffer.from(sig);
  const expectedBuf = Buffer.from(expected);
  if (sigBuf.length !== expectedBuf.length || !timingSafeEqual(sigBuf, expectedBuf)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as OAuthState;
    if (typeof payload.ts !== "number" || Date.now() - payload.ts > STATE_TTL_MS) return null;
    if (typeof payload.projectId !== "string" || typeof payload.userId !== "string") return null;
    return payload;
  } catch {
    return null;
  }
}
