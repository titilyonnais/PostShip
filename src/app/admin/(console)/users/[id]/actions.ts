"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditLog, getAdminSession, requestContext } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/db/service";
import { recordOpsEvent, type OpsSeverity } from "@/lib/ops-events";
import { getStripe } from "@/lib/stripe";

export type ActionState = { error?: string; success?: string };

// Every action here writes to both trails: admin_audit_log, which exists
// to answer "who did this", and ops_events, which puts it next to the
// Stripe and auth events around it. Neither is optional — an operator
// console whose privileged actions leave no trace is an alibi machine.
async function requireOperator() {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");
  return session;
}

async function trace(
  action: string,
  target: string,
  detail: Record<string, unknown>,
  severity: OpsSeverity = "warn",
) {
  const session = await requireOperator();
  const { ip, userAgent } = await requestContext();

  await auditLog({
    accountId: session.accountId,
    username: session.username,
    action,
    target,
    detail,
  });
  await recordOpsEvent({
    source: "console",
    severity,
    action,
    actorAdminId: session.accountId,
    target,
    ip,
    userAgent,
    payload: detail,
  });
}

const BAN_DURATIONS: Record<string, string> = {
  "24h": "24h",
  "7d": "168h",
  // Supabase takes a duration string; "none" is how a ban is lifted.
  permanent: "876000h",
};

export async function banUser(
  userId: string,
  duration: string,
  _prev: ActionState,
): Promise<ActionState> {
  await requireOperator();

  const banDuration = BAN_DURATIONS[duration];
  if (!banDuration) return { error: "Durée invalide." };

  const { error } = await createServiceClient().auth.admin.updateUserById(userId, {
    ban_duration: banDuration,
  });
  if (error) return { error: error.message };

  await trace("user.banned", userId, { duration });
  revalidatePath(`/admin/users/${userId}`);
  return { success: `Compte banni (${duration}).` };
}

export async function unbanUser(
  userId: string,
  _prev: ActionState,
): Promise<ActionState> {
  await requireOperator();

  const { error } = await createServiceClient().auth.admin.updateUserById(userId, {
    ban_duration: "none",
  });
  if (error) return { error: error.message };

  await trace("user.unbanned", userId, {}, "info");
  revalidatePath(`/admin/users/${userId}`);
  return { success: "Bannissement levé." };
}

export async function revokeUserSessions(
  userId: string,
  _prev: ActionState,
): Promise<ActionState> {
  await requireOperator();

  const { error } = await createServiceClient().auth.admin.signOut(userId, "global");
  if (error) return { error: error.message };

  await trace("user.sessions_revoked", userId, {});
  revalidatePath(`/admin/users/${userId}`);
  return { success: "Sessions révoquées." };
}

export async function cancelSubscription(
  userId: string,
  subscriptionId: string,
  mode: "period_end" | "now",
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOperator();

  // Cancelling immediately ends service the customer has paid for, so it
  // asks for the word rather than a click someone can make by reflex.
  if (mode === "now" && String(formData.get("confirm") ?? "").trim() !== "ANNULER") {
    return { error: "Tapez ANNULER pour confirmer une résiliation immédiate." };
  }

  try {
    const stripe = getStripe();
    if (mode === "now") {
      await stripe.subscriptions.cancel(subscriptionId);
    } else {
      await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Échec côté Stripe." };
  }

  await trace("subscription.canceled", userId, { subscriptionId, mode });
  revalidatePath(`/admin/users/${userId}`);
  return {
    success:
      mode === "now"
        ? "Abonnement résilié immédiatement."
        : "Résiliation programmée en fin de période.",
  };
}

export async function refundCharge(
  userId: string,
  chargeId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOperator();

  if (String(formData.get("confirm") ?? "").trim() !== "REMBOURSER") {
    return { error: "Tapez REMBOURSER pour confirmer." };
  }

  try {
    const stripe = getStripe();
    // Re-read the charge rather than trusting the page that rendered the
    // button: it may have been refunded or disputed since, and Stripe's
    // own error for that is not something to show an operator raw.
    const charge = await stripe.charges.retrieve(chargeId);
    if (charge.refunded) return { error: "Ce paiement est déjà remboursé." };
    if (charge.disputed) {
      return { error: "Paiement en litige — le remboursement passe par le litige." };
    }

    await stripe.refunds.create({ charge: chargeId });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Échec côté Stripe." };
  }

  await trace("charge.refunded", userId, { chargeId });
  revalidatePath(`/admin/users/${userId}`);
  return { success: "Remboursement émis." };
}
