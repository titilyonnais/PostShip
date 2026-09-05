// No "server-only" import: that is a separate package, and next/headers
// below already refuses to resolve in a Client Component, which gives the
// same guarantee without a dependency in the admin login path.
import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { createServiceClient } from "@/lib/db/service";
import { recordOpsEvent } from "@/lib/ops-events";

// Session lifetime is bounded twice, because the two bounds answer
// different questions: the idle window limits an unattended screen, the
// absolute one limits a cookie that has been stolen and kept warm.
const IDLE_MS = 30 * 60 * 1000;
const ABSOLUTE_MS = 8 * 60 * 60 * 1000;

// After this many consecutive failures the account is locked, and each
// further failure doubles the wait. Per account rather than per IP alone,
// since an attacker with a botnet has as many IPs as they like. This is
// the main brake on password guessing now that the console runs on a
// single factor.
const LOCK_THRESHOLD = 5;
const LOCK_BASE_MS = 15 * 60 * 1000;

// __Host- is not decoration: a browser only accepts that prefix when the
// cookie is Secure, Path=/ and carries no Domain, which makes it
// impossible for a subdomain — including one an attacker manages to stand
// up — to write a cookie the console would then read.
const COOKIE_NAME =
  process.env.NODE_ENV === "production" ? "__Host-postship_admin" : "postship_admin_dev";

// scrypt parameters travel with the hash so they can be raised later
// without invalidating passwords already stored.
const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 64, maxmem: 96 * 1024 * 1024 };

export function hashPassword(password: string): string {
  const salt = randomBytes(16);
  const derived = scryptSync(password.normalize("NFKC"), salt, SCRYPT.keylen, SCRYPT);
  return [
    "scrypt",
    SCRYPT.N,
    SCRYPT.r,
    SCRYPT.p,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export function verifyPassword(password: string, stored: string): boolean {
  try {
    const [scheme, n, r, p, salt, hash] = stored.split("$");
    if (scheme !== "scrypt") return false;

    const expected = Buffer.from(hash, "base64url");
    const derived = scryptSync(password.normalize("NFKC"), Buffer.from(salt, "base64url"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: SCRYPT.maxmem,
    });
    return derived.length === expected.length && timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export async function requestContext(): Promise<{ ip: string; userAgent: string }> {
  const headerList = await headers();
  // Same trust reasoning as src/lib/auth-rate-limit.ts: only the last hop
  // of x-forwarded-for is one the platform appended; the rest is whatever
  // the client felt like sending.
  const forwardedFor = headerList.get("x-forwarded-for");
  return {
    ip:
      headerList.get("x-real-ip") ??
      forwardedFor?.split(",").pop()?.trim() ??
      "unknown",
    userAgent: headerList.get("user-agent")?.slice(0, 300) ?? "unknown",
  };
}

export type AdminAccount = {
  id: string;
  username: string;
  password_hash: string;
  failed_attempts: number;
  locked_until: string | null;
  disabled: boolean;
};

export async function findAdminAccount(username: string): Promise<AdminAccount | null> {
  const { data } = await createServiceClient()
    .from("admin_accounts")
    .select("id, username, password_hash, failed_attempts, locked_until, disabled")
    .eq("username", username.trim().toLowerCase())
    .maybeSingle();
  return (data as AdminAccount | null) ?? null;
}

export function lockRemainingMs(account: AdminAccount): number {
  if (!account.locked_until) return 0;
  return Math.max(0, new Date(account.locked_until).getTime() - Date.now());
}

export async function recordFailure(account: AdminAccount): Promise<void> {
  const attempts = account.failed_attempts + 1;
  const over = attempts - LOCK_THRESHOLD;
  const lockedUntil =
    over >= 0 ? new Date(Date.now() + LOCK_BASE_MS * 2 ** over).toISOString() : null;

  await createServiceClient()
    .from("admin_accounts")
    .update({ failed_attempts: attempts, locked_until: lockedUntil })
    .eq("id", account.id);
}

export async function clearFailures(accountId: string): Promise<void> {
  await createServiceClient()
    .from("admin_accounts")
    .update({
      failed_attempts: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
    })
    .eq("id", accountId);
}

export async function auditLog(entry: {
  accountId?: string | null;
  username?: string | null;
  action: string;
  target?: string | null;
  detail?: Record<string, unknown> | null;
}): Promise<void> {
  const { ip, userAgent } = await requestContext();
  await createServiceClient().from("admin_audit_log").insert({
    account_id: entry.accountId ?? null,
    username: entry.username ?? null,
    action: entry.action,
    target: entry.target ?? null,
    detail: entry.detail ?? null,
    ip,
    user_agent: userAgent,
  });

  // Written to both on purpose. admin_audit_log stays the narrow
  // tamper-evidence trail for privileged actions; ops_events is where an
  // operator action sits next to the Stripe and auth events around it,
  // which is how you reconstruct what actually happened.
  await recordOpsEvent({
    source: "console",
    severity:
      entry.action.endsWith(".failed") || entry.action.endsWith(".locked")
        ? "warn"
        : "info",
    action: entry.action,
    actorAdminId: entry.accountId ?? null,
    target: entry.target ?? entry.username ?? null,
    ip,
    userAgent,
    payload: entry.detail ?? {},
  });
}

export async function createAdminSession(accountId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const { ip, userAgent } = await requestContext();

  await createServiceClient().from("admin_sessions").insert({
    account_id: accountId,
    token_hash: sha256(token),
    ip,
    user_agent: userAgent,
    expires_at: new Date(Date.now() + ABSOLUTE_MS).toISOString(),
  });

  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    // Strict, not Lax: nothing outside the console should ever navigate
    // into it with credentials attached, which closes CSRF at the cookie
    // rather than relying on a token nobody remembers to check.
    sameSite: "strict",
    path: "/",
    maxAge: Math.floor(ABSOLUTE_MS / 1000),
  });
}

export type AdminSession = {
  sessionId: string;
  accountId: string;
  username: string;
};

// Returns null for every failure mode — expired, revoked, idle-timed-out,
// unknown token — so callers cannot accidentally distinguish them and turn
// this into an oracle.
export async function getAdminSession(): Promise<AdminSession | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("admin_sessions")
    .select("id, account_id, expires_at, last_seen_at, revoked_at, admin_accounts(username, disabled)")
    .eq("token_hash", sha256(token))
    .maybeSingle();

  if (!data) return null;

  const account = data.admin_accounts as unknown as
    | { username: string; disabled: boolean }
    | null;

  const now = Date.now();
  const expired = new Date(data.expires_at).getTime() <= now;
  const idle = now - new Date(data.last_seen_at).getTime() > IDLE_MS;

  if (data.revoked_at || expired || idle || !account || account.disabled) {
    if (!data.revoked_at) {
      await supabase
        .from("admin_sessions")
        .update({ revoked_at: new Date().toISOString() })
        .eq("id", data.id);
    }
    return null;
  }

  // Sliding idle window. Written on every request, which is cheap next to
  // the queries the console runs anyway.
  await supabase
    .from("admin_sessions")
    .update({ last_seen_at: new Date().toISOString() })
    .eq("id", data.id);

  return { sessionId: data.id, accountId: data.account_id, username: account.username };
}

export async function revokeAdminSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (token) {
    await createServiceClient()
      .from("admin_sessions")
      .update({ revoked_at: new Date().toISOString() })
      .eq("token_hash", sha256(token));
  }
  store.delete(COOKIE_NAME);
}

export async function revokeAllSessions(accountId: string): Promise<void> {
  await createServiceClient()
    .from("admin_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("account_id", accountId)
    .is("revoked_at", null);
}
