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
  verifyPassword,
} from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/db/service";
import { verifyTotp } from "@/lib/totp";

export type LoginState = { error?: string };

// One message for every failure. Distinguishing "no such account" from
// "wrong password" from "wrong code" hands an attacker a free oracle for
// enumerating operators and for confirming a password before they have a
// code — and here there is exactly one legitimate user, who always knows
// which of the three they got wrong.
const GENERIC = "Identifiants invalides.";

// Burned when the account doesn't exist, so a request for an unknown
// username costs the same wall-clock time as one for a real account.
// Without it, the response time alone enumerates operators.
const DUMMY_HASH = hashPassword("timing-equalisation-placeholder");

export async function adminSignIn(
  _prevState: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const username = String(formData.get("username") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const code = String(formData.get("code") ?? "");

  if (!username || !password || !code) return { error: GENERIC };

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

  const passwordOk = verifyPassword(password, account.password_hash);
  // Both factors are always evaluated, even when the first already failed:
  // returning early would make a wrong password measurably faster than a
  // wrong code.
  const totpResult = account.totp_secret
    ? verifyTotp(account.totp_secret, code, account.totp_last_step)
    : ({ ok: false, reason: "mismatch" } as const);

  if (!passwordOk || !totpResult.ok) {
    await recordFailure(account);
    await auditLog({
      accountId: account.id,
      username,
      action: "login.failed",
      detail: {
        password: passwordOk,
        totp: totpResult.ok ? "ok" : totpResult.reason,
      },
    });
    return { error: GENERIC };
  }

  // Spend the time step so the same code cannot be replayed inside its
  // remaining window.
  await createServiceClient()
    .from("admin_accounts")
    .update({ totp_last_step: totpResult.step })
    .eq("id", account.id);

  await clearFailures(account.id);
  await createAdminSession(account.id);
  await auditLog({ accountId: account.id, username, action: "login.success" });

  redirect("/admin");
}
