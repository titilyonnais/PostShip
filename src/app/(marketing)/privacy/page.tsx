import Link from "next/link";
import { LEGAL } from "@/lib/legal";

import { ConsentControls } from "./consent-controls";

export const metadata = {
  title: "Confidentialité",
  description: "Politique de confidentialité de PostShip.",
};

export default function PrivacyPage() {
  const contactEmail =
    LEGAL.email === "FIXME_LEGAL" ? LEGAL.publicEmailFallback : LEGAL.email;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16 text-sm text-muted-foreground">
      <Link href="/" className="text-xs hover:text-foreground hover:underline">
        ← Retour
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-foreground">
          Politique de confidentialité
        </h1>
        <p className="mt-1 text-xs">Dernière mise à jour : 1er septembre 2026</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">1. Éditeur</h2>
        <p>
          PostShip est édité par Thibault Morretton, 19 Route de Lyon, 42400
          Saint-Chamond, France. Pour toute question relative à vos données
          personnelles :{" "}
          <a
            href={`mailto:${contactEmail}`}
            className="text-foreground underline underline-offset-2"
          >
            {contactEmail}
          </a>
          .
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
            métadonnées HTML (titre, canonical, présence de JSON-LD),
            horodatage — aucun corps de page n&apos;est conservé
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
            Factures : conservées conformément aux obligations comptables (10
            ans côté prestataire de paiement le cas échéant)
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
        <p>
          Certains de ces sous-traitants (Stripe, Vercel, Resend, Google,
          GitHub) peuvent être amenés à traiter des données aux États-Unis.
          Ces transferts sont encadrés, lorsque le prestataire les propose,
          par les clauses contractuelles types de la Commission européenne.
        </p>
        <p>
          Le numéro de téléphone, lorsqu&apos;il est renseigné, est utilisé
          pour vous contacter et pour la facturation ; sa collecte repose sur
          l&apos;exécution du contrat et, le cas échéant, sur nos obligations
          légales de facturation. Il reste optionnel.
        </p>
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
            <a
              href="mailto:tmorretton@gmail.com"
              className="text-foreground underline underline-offset-2"
            >
              tmorretton@gmail.com
            </a>
          </li>
          <li>
            Vous pouvez introduire une réclamation auprès de la CNIL
            (www.cnil.fr)
          </li>
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          7. Journalisation technique et prévention de la fraude
        </h2>
        <p>
          À chaque page consultée, PostShip enregistre côté serveur :
          l&apos;adresse IP, la page demandée, la page de provenance, la langue
          déclarée par le navigateur, ainsi que le navigateur, le système
          d&apos;exploitation et le type d&apos;appareil déduits de
          l&apos;en-tête <span className="font-mono">User-Agent</span>. Le pays,
          la région, la ville approximative et le fuseau horaire sont fournis
          par notre hébergeur Vercel à partir de l&apos;adresse IP : aucun
          service de géolocalisation tiers n&apos;intervient.
        </p>
        <p>
          <strong className="text-foreground">Base légale :</strong> intérêt
          légitime (article 6.1.f du RGPD) à assurer la sécurité du service et à
          prévenir la fraude et les abus — une finalité que le considérant 49
          du RGPD reconnaît explicitement. Ces données ne servent ni à la
          publicité, ni au profilage commercial, ni à la revente.
        </p>
        <p>
          <strong className="text-foreground">Ce que nous ne collectons
          pas :</strong> aucune empreinte numérique de navigateur (canvas,
          WebGL, polices), aucun identifiant inter-sites, aucun traceur
          publicitaire. Ces techniques exigeraient votre consentement et ne
          répondent à aucun besoin de sécurité.
        </p>
        <p>
          <strong className="text-foreground">Conservation :</strong> le
          journal détaillé des visites est supprimé automatiquement au bout de
          90 jours. Seul un compteur agrégé par adresse (nombre de visites,
          date de dernière visite, pays) est conservé au-delà, sans historique
          de navigation.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">8. Cookies</h2>
        <p>
          <strong className="text-foreground">Cookies strictement
          nécessaires.</strong> PostShip dépose un cookie de session qui vous
          maintient connecté. Sans lui, l&apos;authentification ne peut pas
          fonctionner : il est exempté de consentement au titre de
          l&apos;article 82 de la loi Informatique et Libertés. Il est déposé
          uniquement après connexion et expire avec votre session.
        </p>
        <p>
          <strong className="text-foreground">Mesure d&apos;audience.</strong>{" "}
          Facultative, désactivée par défaut, et activée uniquement si vous
          l&apos;acceptez dans la bannière. Vous pouvez revenir sur votre choix
          à tout moment : refuser n&apos;a jamais demandé plus de clics
          qu&apos;accepter, et un refus est conservé aussi longtemps qu&apos;un
          accord.
        </p>
        <p>
          Aucun cookie publicitaire, aucun traceur tiers, aucun partage avec
          une régie.
        </p>
        <div>
          <ConsentControls />
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">9. Sécurité</h2>
        <p>
          Connexions chiffrées (HTTPS), accès aux données restreint au
          niveau de la base par des règles de sécurité (Row Level Security),
          et protection contre les attaques SSRF sur les vérifications
          effectuées pour votre compte.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          10. Modifications
        </h2>
        <p>
          Cette politique peut être mise à jour ; toute modification
          substantielle vous sera notifiée par email.
        </p>
      </section>
    </div>
  );
}
