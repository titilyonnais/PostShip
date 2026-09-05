"use client";

import { useActionState } from "react";
import { ConfirmAction, NOTE_FIELD } from "@/components/admin/confirm-action";
import {
  banUser,
  cancelSubscription,
  refundCharge,
  revokeUserSessions,
  unbanUser,
  type ActionState,
} from "./actions";

const initial: ActionState = {};

function Feedback({ state }: { state: ActionState }) {
  if (state.error)
    return <p className="font-mono text-xs text-[#f85149]">{state.error}</p>;
  if (state.success)
    return <p className="font-mono text-xs text-[#3fb950]">{state.success}</p>;
  return null;
}

// The customer gets told, and the operator gets to see exactly what will
// be said before it goes — an opt-out rather than a surprise.
function NotifyControls({
  emailSummary,
  placeholder,
}: {
  emailSummary: string;
  placeholder: string;
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-neutral-800 pt-2">
      <label className="flex items-start gap-2 font-mono text-[0.7rem] text-neutral-400">
        <input
          type="checkbox"
          name="notify"
          defaultChecked
          className="mt-0.5 size-3 accent-neutral-300"
        />
        <span>
          Prévenir le client par email
          <span className="block text-neutral-600">{emailSummary}</span>
        </span>
      </label>
      <textarea
        name="note"
        rows={2}
        maxLength={500}
        placeholder={placeholder}
        className={NOTE_FIELD}
      />
    </div>
  );
}

export function AccessActions({ userId, banned }: { userId: string; banned: boolean }) {
  const [ban24, ban24Action] = useActionState(banUser.bind(null, userId, "24h"), initial);
  const [ban7, ban7Action] = useActionState(banUser.bind(null, userId, "7d"), initial);
  const [banPerm, banPermAction] = useActionState(
    banUser.bind(null, userId, "permanent"),
    initial,
  );
  const [unban, unbanAction] = useActionState(unbanUser.bind(null, userId), initial);
  const [revoke, revokeAction] = useActionState(revokeUserSessions.bind(null, userId), initial);

  const banConsequences = (duration: string, restores: string) => [
    `Le compte ne pourra plus se connecter pendant ${duration}.`,
    "La surveillance de ses sites est suspendue, aucune alerte ne partira.",
    restores,
    "Un email lui est envoyé : non-respect des conditions d'utilisation, sans autre détail.",
  ];

  return (
    <div className="flex flex-col gap-3">
      {banned ? (
        <ConfirmAction
          trigger="Lever le bannissement"
          title="Rétablir l'accès à ce compte ?"
          consequences={[
            "Le compte pourra se reconnecter immédiatement.",
            "La surveillance de ses sites reprend.",
            "Un email lui annonce le rétablissement.",
          ]}
          confirmLabel="Rétablir l'accès"
          action={unbanAction}
          feedback={<Feedback state={unban} />}
        />
      ) : (
        <div className="flex flex-wrap gap-3">
          <ConfirmAction
            trigger="Bannir 24 h"
            title="Suspendre ce compte 24 heures ?"
            consequences={banConsequences(
              "24 heures",
              "L'accès est rétabli automatiquement à l'échéance.",
            )}
            confirmLabel="Suspendre 24 h"
            danger
            action={ban24Action}
            feedback={<Feedback state={ban24} />}
          />
          <ConfirmAction
            trigger="Bannir 7 j"
            title="Suspendre ce compte 7 jours ?"
            consequences={banConsequences(
              "7 jours",
              "L'accès est rétabli automatiquement à l'échéance.",
            )}
            confirmLabel="Suspendre 7 j"
            danger
            action={ban7Action}
            feedback={<Feedback state={ban7} />}
          />
          <ConfirmAction
            trigger="Fermer définitivement"
            title="Fermer ce compte définitivement ?"
            consequences={[
              "Le compte ne pourra plus jamais se connecter.",
              "La surveillance de ses sites s'arrête pour de bon.",
              "L'email parle de fermeture définitive et invite à contester en répondant.",
              "Seule une levée manuelle depuis cette page peut revenir en arrière.",
            ]}
            confirmLabel="Fermer le compte"
            danger
            action={banPermAction}
            feedback={<Feedback state={banPerm} />}
          />
        </div>
      )}

      <ConfirmAction
        trigger="Révoquer les sessions"
        title="Déconnecter ce compte partout ?"
        consequences={[
          "Toutes ses sessions ouvertes sont fermées, sur tous ses appareils.",
          "Il pourra se reconnecter normalement juste après.",
          "Aucun email n'est envoyé : ce n'est pas une sanction.",
        ]}
        confirmLabel="Déconnecter partout"
        action={revokeAction}
        feedback={<Feedback state={revoke} />}
      />

      {/* Deliberately absent: sending a password reset or a magic link.
          An authentication email the customer didn't ask for, arriving
          right after they contacted support, is indistinguishable from
          phishing — and teaching customers to click those is how support
          becomes an attack vector. */}
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
  endsAtLabel,
}: {
  userId: string;
  subscriptionId: string;
  cancelAtPeriodEnd: boolean;
  endsAtLabel: string | null;
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
    <div className="flex flex-wrap gap-3">
      {!cancelAtPeriodEnd && (
        <ConfirmAction
          trigger="Annuler en fin de période"
          title="Ne pas reconduire cet abonnement ?"
          consequences={[
            endsAtLabel
              ? `L'accès payant reste actif jusqu'au ${endsAtLabel}.`
              : "L'accès payant reste actif jusqu'au terme de la période en cours.",
            "Aucun nouveau prélèvement ne sera effectué.",
            "Rien n'est remboursé : la période en cours est déjà réglée.",
            "Les projets et l'historique du client restent en place.",
          ]}
          confirmLabel="Programmer la résiliation"
          action={periodEndAction}
          feedback={<Feedback state={periodEnd} />}
        >
          <NotifyControls
            emailSummary="Explique que l'abonnement court jusqu'à son terme puis s'arrête."
            placeholder="Mot au client, facultatif — repris tel quel dans l'email."
          />
        </ConfirmAction>
      )}

      <ConfirmAction
        trigger="Résilier maintenant"
        title="Couper l'abonnement immédiatement ?"
        consequences={[
          "L'accès aux fonctionnalités payantes s'arrête à la seconde.",
          "Le client perd du temps déjà payé — envisagez un remboursement.",
          "Aucun remboursement n'est émis automatiquement.",
          "Les projets et l'historique restent en place.",
        ]}
        confirmLabel="Résilier immédiatement"
        danger
        action={nowAction}
        feedback={<Feedback state={now} />}
      >
        <NotifyControls
          emailSummary="Annonce l'arrêt immédiat et rassure sur la conservation des données."
          placeholder="Mot au client, facultatif — repris tel quel dans l'email."
        />
      </ConfirmAction>
    </div>
  );
}

export function RefundAction({
  userId,
  chargeId,
  amountLabel,
}: {
  userId: string;
  chargeId: string;
  amountLabel: string;
}) {
  const [state, action] = useActionState(refundCharge.bind(null, userId, chargeId), initial);

  return (
    <ConfirmAction
      trigger="Rembourser"
      title={`Rembourser ${amountLabel} ?`}
      consequences={[
        `${amountLabel} sont recrédités sur le moyen de paiement d'origine.`,
        "Comptez 5 à 10 jours ouvrés côté banque.",
        "L'abonnement n'est pas résilié pour autant.",
        "Un remboursement n'est pas annulable.",
      ]}
      confirmLabel={`Rembourser ${amountLabel}`}
      danger
      action={action}
      feedback={<Feedback state={state} />}
    >
      <NotifyControls
        emailSummary="Annonce le montant, le délai bancaire et le libellé sur le relevé."
        placeholder="Motif à communiquer, facultatif — repris tel quel dans l'email."
      />
    </ConfirmAction>
  );
}
