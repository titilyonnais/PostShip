import { Resend } from "resend";
import {
  escapeHtml,
  INSET_BG,
  renderEmailShell,
  TEXT,
  TEXT_FAINT,
  TEXT_MUTED,
} from "@/lib/email-template";

// Transactional mail sent on the operator's behalf when the console
// changes something about a customer's account.
//
// The tone is the whole point. These arrive unannounced, about money or
// access, and a terse or evasive one turns a routine action into a
// support ticket — or into a chargeback, in the case of a refund the
// customer doesn't recognise on their statement.
//
// Never throws: an email that fails must not roll back an action that
// already happened in Stripe or in Auth.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://postship.fr";
const SUPPORT = process.env.SUPPORT_EMAIL ?? "support@postship.fr";

function detailBlock(rows: [string, string][]): string {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background-color:${INSET_BG};border-radius:16px;padding:4px 16px;">
    ${rows
      .map(
        ([label, value]) => `<tr>
      <td style="padding:6px 0;font-size:12px;color:${TEXT_MUTED};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;white-space:nowrap;">${escapeHtml(label)}</td>
      <td style="padding:6px 0 6px 16px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:${TEXT};text-align:right;">${escapeHtml(value)}</td>
    </tr>`,
      )
      .join("")}
  </table>`;
}

function footNote(text: string): string {
  return `<p style="margin:16px 0 0;font-size:12px;line-height:1.6;color:${TEXT_MUTED};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${text}</p>
  <p style="margin:10px 0 0;font-size:11px;color:${TEXT_FAINT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Une question&nbsp;? Répondez à cet email ou écrivez à ${escapeHtml(SUPPORT)}.</p>`;
}

async function send(to: string, subject: string, text: string, html: string): Promise<boolean> {
  if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return false;
  try {
    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({ from: process.env.RESEND_FROM, to, subject, text, html });
    return true;
  } catch (err) {
    console.error("Échec envoi email console", subject, err);
    return false;
  }
}

function formatAmount(amount: number, currency: string): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(amount / 100);
}

export async function sendRefundEmail(params: {
  to: string;
  amount: number;
  currency: string;
  /** Free text the operator wrote; empty when they wrote nothing. */
  reason: string;
}): Promise<boolean> {
  const amount = formatAmount(params.amount, params.currency);

  return send(
    params.to,
    `Remboursement de ${amount} — PostShip`,
    [
      `Nous venons de vous rembourser ${amount}.`,
      params.reason,
      "Comptez 5 à 10 jours ouvrés pour que votre banque crédite la somme.",
    ]
      .filter(Boolean)
      .join("\n\n"),
    renderEmailShell({
      preheader: `Remboursement de ${amount} en cours`,
      eyebrow: "Facturation",
      title: "Votre remboursement est en route",
      intro: `Nous venons de vous rembourser ${amount}.`,
      bodyHtml:
        detailBlock([
          ["Montant", amount],
          ["Émis le", new Date().toLocaleDateString("fr-FR")],
          ["Délai bancaire", "5 à 10 jours ouvrés"],
        ]) +
        (params.reason
          ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${TEXT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escapeHtml(params.reason)}</p>`
          : "") +
        // The statement line is the practical detail: a refund the
        // customer can't match to a charge is what becomes a chargeback.
        footNote(
          "Le remboursement apparaîtra sur le relevé du moyen de paiement utilisé lors de l'achat, sous le même libellé que le prélèvement d'origine.",
        ),
      cta: { href: `${APP_URL}/app/account?tab=billing`, label: "Voir mes factures" },
    }),
  );
}

export async function sendCancellationEmail(params: {
  to: string;
  planLabel: string;
  immediate: boolean;
  /** Unix seconds; only meaningful when the cancellation is deferred. */
  endsAt: number | null;
  reason: string;
}): Promise<boolean> {
  const endsAtLabel = params.endsAt
    ? new Date(params.endsAt * 1000).toLocaleDateString("fr-FR")
    : null;

  const title = params.immediate
    ? "Votre abonnement a pris fin"
    : "Votre abonnement ne sera pas reconduit";

  const intro = params.immediate
    ? `Votre abonnement ${params.planLabel} est résilié et l'accès aux fonctionnalités payantes s'arrête dès maintenant.`
    : `Votre abonnement ${params.planLabel} restera actif jusqu'au terme de la période déjà réglée, puis ne sera pas reconduit.`;

  return send(
    params.to,
    title,
    [intro, params.reason, "Vos projets et vos données restent en place."]
      .filter(Boolean)
      .join("\n\n"),
    renderEmailShell({
      preheader: intro,
      eyebrow: "Abonnement",
      title,
      intro,
      bodyHtml:
        detailBlock(
          [
            ["Formule", params.planLabel],
            [
              params.immediate ? "Fin d'accès" : "Dernier jour d'accès",
              params.immediate ? "immédiate" : (endsAtLabel ?? "fin de période en cours"),
            ],
            ["Prochain prélèvement", "aucun"],
          ].filter(Boolean) as [string, string][],
        ) +
        (params.reason
          ? `<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${TEXT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escapeHtml(params.reason)}</p>`
          : "") +
        // Said explicitly because it is the first thing anyone worries
        // about when a subscription ends.
        footNote(
          "Vos projets, vos URLs surveillées et votre historique restent en place. Vous pouvez reprendre un abonnement à tout moment et les retrouver tels quels.",
        ),
      cta: { href: `${APP_URL}/app/billing`, label: "Gérer mon abonnement" },
    }),
  );
}

const BAN_COPY: Record<
  string,
  { title: string; duration: string; intro: string; back: string }
> = {
  "24h": {
    title: "Votre accès est suspendu pour 24 heures",
    duration: "24 heures",
    intro:
      "Votre compte PostShip est temporairement suspendu à la suite d'une utilisation contraire à nos conditions d'utilisation.",
    back: "L'accès sera rétabli automatiquement à l'issue des 24 heures.",
  },
  "7d": {
    title: "Votre accès est suspendu pour 7 jours",
    duration: "7 jours",
    intro:
      "Votre compte PostShip est suspendu pour 7 jours à la suite d'une utilisation contraire à nos conditions d'utilisation.",
    back: "L'accès sera rétabli automatiquement à l'issue des 7 jours.",
  },
  permanent: {
    title: "Votre compte a été fermé",
    duration: "définitive",
    intro:
      "Votre compte PostShip a été fermé pour utilisation contraire à nos conditions d'utilisation.",
    back: "Cette fermeture est définitive. Si vous estimez qu'il s'agit d'une erreur, répondez à cet email : chaque contestation est examinée.",
  },
};

// No specifics, deliberately. Naming the exact rule and the exact
// evidence tells someone acting in bad faith precisely what to change,
// and someone acting in good faith is better served by a reply from a
// human than by a paragraph of policy in an automated email.
export async function sendBanEmail(params: {
  to: string;
  duration: "24h" | "7d" | "permanent";
}): Promise<boolean> {
  const copy = BAN_COPY[params.duration];
  if (!copy) return false;

  const monitoringNote =
    params.duration === "permanent"
      ? "La surveillance de vos sites est arrêtée et aucune alerte ne vous sera plus envoyée."
      : "La surveillance de vos sites est suspendue pendant cette période : aucune alerte ne partira jusqu'au rétablissement.";

  return send(
    params.to,
    copy.title,
    [copy.intro, monitoringNote, copy.back].join("\n\n"),
    renderEmailShell({
      preheader: copy.intro,
      eyebrow: "Accès au compte",
      title: copy.title,
      intro: copy.intro,
      bodyHtml:
        detailBlock([
          ["Durée", copy.duration],
          ["Depuis le", new Date().toLocaleDateString("fr-FR")],
        ]) +
        `<p style="margin:16px 0 0;font-size:13px;line-height:1.6;color:${TEXT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escapeHtml(monitoringNote)}</p>` +
        footNote(copy.back),
    }),
  );
}

export async function sendUnbanEmail(to: string): Promise<boolean> {
  const intro = "Votre compte PostShip est de nouveau accessible.";
  return send(
    to,
    "Votre accès a été rétabli",
    `${intro}\n\nLa surveillance de vos sites reprend immédiatement.`,
    renderEmailShell({
      preheader: intro,
      eyebrow: "Accès au compte",
      title: "Votre accès a été rétabli",
      intro,
      bodyHtml: footNote("La surveillance de vos sites reprend immédiatement."),
      cta: { href: `${APP_URL}/app`, label: "Ouvrir le tableau de bord" },
    }),
  );
}
