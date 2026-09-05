"use server";

import { redirect } from "next/navigation";
import { checkAuthRateLimit } from "@/lib/auth-rate-limit";
import {
  auditLog,
  clearFailures,
  createAdminSession,
  findAdminAccount,
  hashPassword,
  lockRemainingMs,
  recordFailure,
  requestContext,
  verifyPassword,
} from "@/lib/admin-auth";
import { sendAdminLoginAlert } from "@/lib/admin-login-alert";
import { recordOpsEvent } from "@/lib/ops-events";

export type LoginState = { error?: string };

// One message for every failure. Distinguishing "no such account" from
// "wrong password" hands an attacker a free oracle for enumerating
// operators, and here there is exactly one legitimate user who always
// knows which of the two they got wrong.
const GENERIC = "Identifiants invalides.";

// Burned when the account doesn't exist, so a request for an unknown
// username costs the same wall-clock time as one for a real account.
// Without it, the response time alone enumerates operators — and with the
// second factor gone this is the only thing standing between an attacker
// and a confirmed username to grind against.
const DUMMY_HASH = hashPassword("timing-equalisation-placeholder");

// Matches LOCK_THRESHOLD in src/lib/admin-auth.ts: the attempt that trips
// the lockout is the one worth emailing about.
const LOCK_ALERT_AT = 5;

export async function adminSignIn(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  if (!username || !password) return { error: GENERIC };

  // IP-level ceiling on top of the per-account lockout below: the lockout
  // stops someone hammering one account, this stops them spraying many.
  if (!(await checkAuthRateLimit())) {
    await auditLog({ username, action: "login.rate_limited" });
    return { error: "Trop de tentatives. Réessayez plus tard." };
  }

  const account = await findAdminAccount(username);

  if (!account) {
    verifyPassword(password, DUMMY_HASH);
    await auditLog({ username, action: "login.unknown_account" });
    return { error: GENERIC };
  }

  if (account.disabled) {
    await auditLog({ accountId: account.id, username, action: "login.disabled" });
    return { error: GENERIC };
  }

  const lockMs = lockRemainingMs(account);
  if (lockMs > 0) {
    // The one case worth naming: a locked-out operator staring at
    // "identifiants invalides" while typing the right password would
    // reasonably conclude the account is broken.
    await auditLog({ accountId: account.id, username, action: "login.locked" });
    return {
      error: `Compte verrouillé — réessayez dans ${Math.ceil(lockMs / 60000)} min.`,
    };
  }

  if (!verifyPassword(password, account.password_hash)) {
    await recordFailure(account);
    await auditLog({ accountId: account.id, username, action: "login.failed" });

    // The failure that just tripped the lock is worth an email of its own:
    // someone is grinding the only factor this console has.
    if (account.failed_attempts + 1 >= LOCK_ALERT_AT) {
      const { ip, userAgent } = await requestContext();
      await sendAdminLoginAlert({
        accountId: account.id,
        username,
        ip,
        userAgent,
        kind: "locked",
      });
      // Someone grinding the console's only factor is the definition of
      // what the fraud severity is for.
      await recordOpsEvent({
        source: "admin_alert",
        severity: "fraud",
        action: "admin.login.locked",
        actorAdminId: account.id,
        target: username,
        ip,
        userAgent,
        payload: { failed_attempts: account.failed_attempts + 1 },
      });
    }

    return { error: GENERIC };
  }

  await clearFailures(account.id);
  await createAdminSession(account.id);
  await auditLog({ accountId: account.id, username, action: "login.success" });

  // After the session row exists, so the alert can compare this login
  // against every previous one and say whether the IP and the device have
  // ever been seen before.
  const { ip, userAgent } = await requestContext();
  await sendAdminLoginAlert({
    accountId: account.id,
    username,
    ip,
    userAgent,
    kind: "success",
  });

  redirect("/admin");
}
