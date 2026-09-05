"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditLog, getAdminSession, requestContext } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/db/service";
import { recordOpsEvent, type OpsSeverity } from "@/lib/ops-events";
import { getStripe } from "@/lib/stripe";
import {
  sendBanEmail,
  sendCancellationEmail,
  sendRefundEmail,
  sendUnbanEmail,
} from "@/lib/admin-emails";

export type ActionState = { error?: string; success?: string };

// Every action that changes something for a customer tells them so. An
// unexplained refund on a statement is what a chargeback is made of, and
// an account that stops working without a word is a support ticket that
// starts angry.
async function customerEmail(userId: string): Promise<string | null> {
  const { data } = await createServiceClient()
    .from("profiles")
    .select("email")
    .eq("id", userId)
    .maybeSingle();
  return data?.email ?? null;
}

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

  const email = await customerEmail(userId);
  const notified = email
    ? await sendBanEmail({ to: email, duration: duration as "24h" | "7d" | "permanent" })
    : false;

  await trace("user.banned", userId, { duration, notified });
  revalidatePath(`/admin/users/${userId}`);
  return {
    success: notified
      ? `Compte banni (${duration}), client prévenu par email.`
      : `Compte banni (${duration}). Aucun email envoyé.`,
  };
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

  const email = await customerEmail(userId);
  const notified = email ? await sendUnbanEmail(email) : false;

  await trace("user.unbanned", userId, { notified }, "info");
  revalidatePath(`/admin/users/${userId}`);
  return {
    success: notified ? "Bannissement levé, client prévenu." : "Bannissement levé.",
  };
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

  // The operator's own words, passed through to the customer verbatim.
  // Optional: a cancellation with no explanation still reads better than
  // one invented on their behalf.
  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  const notify = formData.get("notify") !== "off";

  let planLabel = "PostShip";
  let endsAt: number | null = null;

  try {
    const stripe = getStripe();
    // Read before writing: the price and period end go into the email,
    // and after cancellation Stripe no longer reports the period the
    // customer actually paid for.
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const item = subscription.items.data[0];
    planLabel =
      (item?.price?.nickname ??
        (item?.price?.unit_amount != null
          ? `${(item.price.unit_amount / 100).toFixed(0)} ${item.price.currency.toUpperCase()} / ${item.price.recurring?.interval ?? "mois"}`
          : null)) ??
      "PostShip";
    endsAt =
      (item as { current_period_end?: number } | undefined)?.current_period_end ??
      (subscription as unknown as { current_period_end?: number }).current_period_end ??
      null;

    if (mode === "now") {
      await stripe.subscriptions.cancel(subscriptionId);
    } else {
      await stripe.subscriptions.update(subscriptionId, { cancel_at_period_end: true });
    }
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Échec côté Stripe." };
  }

  let notified = false;
  if (notify) {
    const email = await customerEmail(userId);
    notified = email
      ? await sendCancellationEmail({
          to: email,
          planLabel,
          immediate: mode === "now",
          endsAt,
          reason: note,
        })
      : false;
  }

  await trace("subscription.canceled", userId, { subscriptionId, mode, notified, note });
  revalidatePath(`/admin/users/${userId}`);
  return {
    success:
      (mode === "now"
        ? "Abonnement résilié immédiatement."
        : "Résiliation programmée en fin de période.") +
      (notified ? " Client prévenu." : ""),
  };
}

export async function refundCharge(
  userId: string,
  chargeId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireOperator();

  const note = String(formData.get("note") ?? "").trim().slice(0, 500);
  const notify = formData.get("notify") !== "off";

  let amount = 0;
  let currency = "eur";

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

    amount = charge.amount;
    currency = charge.currency;
    await stripe.refunds.create({ charge: chargeId });
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Échec côté Stripe." };
  }

  let notified = false;
  if (notify) {
    const email = await customerEmail(userId);
    notified = email
      ? await sendRefundEmail({ to: email, amount, currency, reason: note })
      : false;
  }

  await trace("charge.refunded", userId, { chargeId, amount, currency, notified, note });
  revalidatePath(`/admin/users/${userId}`);
  return {
    success: notified
      ? "Remboursement émis, client prévenu par email."
      : "Remboursement émis. Aucun email envoyé.",
  };
}
