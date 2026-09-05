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

export type SecurityState = { error?: string; success?: string };

// The current password is re-checked before it can be replaced. Without
// it, a session left open on an unlocked screen — the exact scenario the
// idle timeout only narrows — would be enough to take the account over
// permanently.
async function reauthenticate(
  formData: FormData,
): Promise<{ ok: true; accountId: string; username: string } | { ok: false; error: string }> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const password = String(formData.get("current_password") ?? "");

  const { data: account } = await createServiceClient()
    .from("admin_accounts")
    .select("id, password_hash")
    .eq("id", session.accountId)
    .single();

  if (!account) return { ok: false, error: "Compte introuvable." };

  if (!verifyPassword(password, account.password_hash)) {
    await auditLog({
      accountId: session.accountId,
      username: session.username,
      action: "security.reauth_failed",
    });
    return { ok: false, error: "Mot de passe invalide." };
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
  // produce predictable substitutions. It carries more weight now that it
  // is the only factor.
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
