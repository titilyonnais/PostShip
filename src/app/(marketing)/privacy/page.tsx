import Link from "next/link";
import { AlertTriangle } from "lucide-react";

export const metadata = {
  title: "Confidentialité",
  description: "Politique de confidentialité de PostShip.",
};

function LegalPlaceholder({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-sm bg-amber-500/15 px-1 py-0.5 text-amber-600 dark:text-amber-400">
      {children}
    </span>
  );
}

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16 text-sm text-muted-foreground">
      <Link href="/" className="text-xs hover:text-foreground hover:underline">
        ← Retour
      </Link>

      <div className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2.5 text-xs text-amber-600 dark:text-amber-400">
        <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
        <span>
          Brouillon rédigé à partir de l&apos;architecture réelle du service.
          Les champs surlignés (identité de l&apos;éditeur) sont à compléter,
          et une relecture rapide par un professionnel du droit est
          recommandée avant de considérer ce texte comme définitif.
        </span>
      </div>

      <div>
        <h1 className="text-lg font-semibold text-foreground">
          Politique de confidentialité
        </h1>
        <p className="mt-1 text-xs">Dernière mise à jour : 1er septembre 2026</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">1. Éditeur</h2>
        <p>
          PostShip est édité par{" "}
          <LegalPlaceholder>
            [raison sociale ou nom en tant qu&apos;auto-entrepreneur]
          </LegalPlaceholder>
          , <LegalPlaceholder>[adresse]</LegalPlaceholder>,{" "}
          <LegalPlaceholder>[SIRET si applicable]</LegalPlaceholder>. Pour
          toute question relative à vos données personnelles :{" "}
          <LegalPlaceholder>[email de contact]</LegalPlaceholder>.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          2. Données que nous collectons
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            Compte : adresse email, nom complet, société, téléphone, pseudo,
            avatar (généré automatiquement, aucune photo n&apos;est
            demandée)
          </li>
          <li>
            Facturation : adresse de facturation, gérée par notre prestataire
            de paiement Stripe
          </li>
          <li>
            Projets : nom du projet, URL de production, liste des URLs
            surveillées et leur configuration
          </li>
          <li>
            Résultats de vérification : statut HTTP, temps de réponse,
            extrait de la réponse (512 Ko maximum), horodatage
          </li>
          <li>
            Techniques : adresse IP au moment de la connexion, cookie de
            session
          </li>
        </ul>
        <p>
          PostShip ne surveille que les URLs que vous configurez
          vous-même — aucune donnée n&apos;est collectée en dehors de ce
          périmètre.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          3. Pourquoi nous les utilisons
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            Exécution du contrat : fournir le service de surveillance,
            facturer l&apos;abonnement
          </li>
          <li>
            Intérêt légitime : sécurité du service, prévention des abus
            (règles anti-SSRF sur les vérifications effectuées)
          </li>
          <li>
            Consentement : envoi d&apos;alertes vers Discord si vous
            configurez un webhook
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          4. Durée de conservation
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            Historique des vérifications : 7 jours (Free), 14 jours (Solo),
            30 jours (Team) — purgé automatiquement chaque nuit
          </li>
          <li>
            Données de compte : conservées tant que le compte existe,
            supprimées intégralement et immédiatement lors de sa suppression
          </li>
          <li>
            Factures : conservées par Stripe selon les obligations légales
            comptables en vigueur
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          5. Sous-traitants
        </h2>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>Supabase — hébergement de la base de données et authentification (Union Européenne)</li>
          <li>Stripe — paiement et facturation</li>
          <li>Resend — envoi des emails de connexion et d&apos;alerte</li>
          <li>Discord — uniquement si vous configurez un webhook pour vos alertes</li>
          <li>Vercel — hébergement de l&apos;application</li>
          <li>Google / GitHub — uniquement si vous utilisez la connexion via ces services</li>
        </ul>
        <p>Aucune donnée n&apos;est vendue à des tiers.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">6. Vos droits</h2>
        <p>
          Conformément au RGPD, vous disposez d&apos;un droit d&apos;accès,
          de rectification, d&apos;effacement, de portabilité et
          d&apos;opposition sur vos données.
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            Export de vos données : Paramètres → Vue d&apos;ensemble →
            Exporter mes données
          </li>
          <li>
            Suppression de votre compte : Paramètres → Zone dangereuse
            (action immédiate et irréversible)
          </li>
          <li>
            Pour toute autre demande :{" "}
            <LegalPlaceholder>[email de contact]</LegalPlaceholder>
          </li>
          <li>
            Vous pouvez introduire une réclamation auprès de la CNIL
            (www.cnil.fr)
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">7. Cookies</h2>
        <p>
          PostShip utilise uniquement des cookies strictement nécessaires au
          fonctionnement du service (maintien de votre session de
          connexion). Aucun cookie publicitaire ni traceur analytique tiers
          n&apos;est utilisé.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">8. Sécurité</h2>
        <p>
          Connexions chiffrées (HTTPS), accès aux données restreint au
          niveau de la base par des règles de sécurité (Row Level Security),
          et protection contre les attaques SSRF sur les vérifications
          effectuées pour votre compte.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          9. Modifications
        </h2>
        <p>
          Cette politique peut être mise à jour ; toute modification
          substantielle vous sera notifiée par email.
        </p>
      </section>
    </div>
  );
}
