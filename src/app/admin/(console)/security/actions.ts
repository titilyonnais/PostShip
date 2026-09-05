"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  auditLog,
  getAdminSession,
  hashPassword,
  revokeAllSessions,
  verifyPassword,
} from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/db/service";
import { generateTotpSecret, totpUri, verifyTotp } from "@/lib/totp";

export type SecurityState = { error?: string; success?: string; secret?: string; uri?: string };

// Both factors are re-checked before either can be changed. Without it, a
// session left open on an unlocked screen — the exact scenario the idle
// timeout only narrows — would be enough to take the account over
// permanently by swapping the password and the authenticator.
async function reauthenticate(
  formData: FormData,
): Promise<{ ok: true; accountId: string; username: string } | { ok: false; error: string }> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const password = String(formData.get("current_password") ?? "");
  const code = String(formData.get("current_code") ?? "");

  const { data: account } = await createServiceClient()
    .from("admin_accounts")
    .select("id, password_hash, totp_secret, totp_last_step")
    .eq("id", session.accountId)
    .single();

  if (!account) return { ok: false, error: "Compte introuvable." };

  const passwordOk = verifyPassword(password, account.password_hash);
  const totpOk = account.totp_secret
    ? verifyTotp(account.totp_secret, code, account.totp_last_step).ok
    : false;

  if (!passwordOk || !totpOk) {
    await auditLog({
      accountId: session.accountId,
      username: session.username,
      action: "security.reauth_failed",
    });
    return { ok: false, error: "Mot de passe ou code invalide." };
  }

  return { ok: true, accountId: session.accountId, username: session.username };
}

const MIN_LENGTH = 16;

export async function changePassword(
  _prev: SecurityState,
  formData: FormData,
): Promise<SecurityState> {
  const auth = await reauthenticate(formData);
  if (!auth.ok) return { error: auth.error };

  const next = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");

  // Length over composition rules: a 16-character passphrase beats a
  // 10-character one with a symbol in it, and composition rules mostly
  // produce predictable substitutions.
  if (next.length < MIN_LENGTH) {
    return { error: `Le mot de passe doit faire au moins ${MIN_LENGTH} caractères.` };
  }
  if (next !== confirm) return { error: "Les deux saisies diffèrent." };

  await createServiceClient()
    .from("admin_accounts")
    .update({ password_hash: hashPassword(next) })
    .eq("id", auth.accountId);

  // Every other session dies with the old password — that is the whole
  // point of changing it after a suspected compromise.
  await revokeAllSessions(auth.accountId);
  await auditLog({
    accountId: auth.accountId,
    username: auth.username,
    action: "security.password_changed",
  });

  redirect("/admin/login");
}

export async function startTotpRotation(
  _prev: SecurityState,
  formData: FormData,
): Promise<SecurityState> {
  const auth = await reauthenticate(formData);
  if (!auth.ok) return { error: auth.error };

  const secret = generateTotpSecret();
  // Parked on the row but not activated: totp_secret only changes once a
  // code from the new authenticator has been proved, so a half-finished
  // rotation can never lock the operator out.
  await createServiceClient()
    .from("admin_accounts")
    .update({ pending_totp_secret: secret })
    .eq("id", auth.accountId);

  await auditLog({
    accountId: auth.accountId,
    username: auth.username,
    action: "security.totp_rotation_started",
  });

  return {
    secret,
    uri: totpUri(secret, auth.username),
    success: "Scannez le code, puis confirmez avec un code de la nouvelle application.",
  };
}

export async function confirmTotpRotation(
  _prev: SecurityState,
  formData: FormData,
): Promise<SecurityState> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const code = String(formData.get("new_code") ?? "");

  const service = createServiceClient();
  const { data: account } = await service
    .from("admin_accounts")
    .select("pending_totp_secret")
    .eq("id", session.accountId)
    .single();

  if (!account?.pending_totp_secret) {
    return { error: "Aucune rotation en cours." };
  }

  const result = verifyTotp(account.pending_totp_secret, code, null);
  if (!result.ok) return { error: "Code invalide." };

  await service
    .from("admin_accounts")
    .update({
      totp_secret: account.pending_totp_secret,
      pending_totp_secret: null,
      totp_enrolled_at: new Date().toISOString(),
      totp_last_step: result.step,
    })
    .eq("id", session.accountId);

  await auditLog({
    accountId: session.accountId,
    username: session.username,
    action: "security.totp_rotated",
  });

  revalidatePath("/admin/security");
  return { success: "Nouvelle application d'authentification active." };
}

export async function revokeOtherSessions(): Promise<void> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  await createServiceClient()
    .from("admin_sessions")
    .update({ revoked_at: new Date().toISOString() })
    .eq("account_id", session.accountId)
    .neq("id", session.sessionId)
    .is("revoked_at", null);

  await auditLog({
    accountId: session.accountId,
    username: session.username,
    action: "security.sessions_revoked",
  });

  revalidatePath("/admin/security");
}
