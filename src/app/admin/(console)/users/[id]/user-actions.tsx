"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  banUser,
  cancelSubscription,
  refundCharge,
  revokeUserSessions,
  unbanUser,
  type ActionState,
} from "./actions";

const initial: ActionState = {};

const FIELD =
  "border border-neutral-800 bg-[#0d0f12] px-2 py-1 font-mono text-xs text-neutral-100 placeholder:text-neutral-700 focus:border-[#f85149] focus:outline-none";

function Btn({
  children,
  danger,
}: {
  children: string;
  danger?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`border px-2 py-1 font-mono text-xs disabled:opacity-50 ${
        danger
          ? "border-[#f85149]/40 text-[#f85149] hover:border-[#f85149]"
          : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
      }`}
    >
      {pending ? "..." : children}
    </button>
  );
}

function Feedback({ state }: { state: ActionState }) {
  if (state.error) return <span className="font-mono text-xs text-[#f85149]">{state.error}</span>;
  if (state.success)
    return <span className="font-mono text-xs text-[#3fb950]">{state.success}</span>;
  return null;
}

export function AccessActions({
  userId,
  banned,
}: {
  userId: string;
  banned: boolean;
}) {
  const [ban24, ban24Action] = useActionState(banUser.bind(null, userId, "24h"), initial);
  const [ban7, ban7Action] = useActionState(banUser.bind(null, userId, "7d"), initial);
  const [banPerm, banPermAction] = useActionState(
    banUser.bind(null, userId, "permanent"),
    initial,
  );
  const [unban, unbanAction] = useActionState(unbanUser.bind(null, userId), initial);
  const [revoke, revokeAction] = useActionState(revokeUserSessions.bind(null, userId), initial);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-2">
        {banned ? (
          <form action={unbanAction}>
            <Btn>Lever le bannissement</Btn>
          </form>
        ) : (
          <>
            <form action={ban24Action}>
              <Btn danger>Bannir 24 h</Btn>
            </form>
            <form action={ban7Action}>
              <Btn danger>Bannir 7 j</Btn>
            </form>
            <form action={banPermAction}>
              <Btn danger>Bannir définitivement</Btn>
            </form>
          </>
        )}
        <form action={revokeAction}>
          <Btn>Révoquer les sessions</Btn>
        </form>
      </div>
      {[ban24, ban7, banPerm, unban, revoke].map((state, i) => (
        <Feedback key={i} state={state} />
      ))}
      {/* Deliberately absent: sending a password reset or a magic link
          from here. An email the customer didn't ask for, arriving right
          after they contacted support, is indistinguishable from phishing
          — and teaching customers to click those is how support becomes
          an attack vector. */}
      <p className="font-mono text-[0.65rem] text-neutral-700">
        Pas d&apos;envoi de lien de connexion depuis la console : un email
        d&apos;authentification non sollicité est indistinguable d&apos;un
        phishing.
      </p>
    </div>
  );
}

export function SubscriptionActions({
  userId,
  subscriptionId,
  cancelAtPeriodEnd,
}: {
  userId: string;
  subscriptionId: string;
  cancelAtPeriodEnd: boolean;
}) {
  const [periodEnd, periodEndAction] = useActionState(
    cancelSubscription.bind(null, userId, subscriptionId, "period_end"),
    initial,
  );
  const [now, nowAction] = useActionState(
    cancelSubscription.bind(null, userId, subscriptionId, "now"),
    initial,
  );

  return (
    <div className="flex flex-col gap-2">
      {!cancelAtPeriodEnd && (
        <form action={periodEndAction}>
          <Btn>Annuler en fin de période</Btn>
        </form>
      )}
      <form action={nowAction} className="flex flex-wrap items-center gap-2">
        <input name="confirm" placeholder="tapez ANNULER" className={FIELD} />
        <Btn danger>Annuler maintenant</Btn>
      </form>
      <Feedback state={periodEnd} />
      <Feedback state={now} />
    </div>
  );
}

export function RefundAction({ userId, chargeId }: { userId: string; chargeId: string }) {
  const [state, action] = useActionState(refundCharge.bind(null, userId, chargeId), initial);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input name="confirm" placeholder="tapez REMBOURSER" className={FIELD} />
      <Btn danger>Rembourser</Btn>
      <Feedback state={state} />
    </form>
  );
}
