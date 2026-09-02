import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "CGV",
  description: "Conditions générales de vente de PostShip.",
};

const contactEmail =
  LEGAL.email === "FIXME_LEGAL" ? LEGAL.publicEmailFallback : LEGAL.email;

export default function CgvPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16 text-sm text-muted-foreground">
      <Link href="/" className="text-xs hover:text-foreground hover:underline">
        ← Retour
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-foreground">
          Conditions générales de vente
        </h1>
        <p className="mt-1 text-xs">Dernière mise à jour : 2 septembre 2026</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">1. Éditeur</h2>
        <p>
          Les présentes conditions générales de vente (CGV) régissent la
          vente des abonnements et packs de tokens du service PostShip,
          édité par {LEGAL.editorName}, {LEGAL.address}. Elles complètent
          les{" "}
          <Link href="/terms" className="text-foreground underline underline-offset-2">
            CGU
          </Link>{" "}
          et s&apos;appliquent à toute souscription payante.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">2. Offres et prix</h2>
        <p>
          PostShip propose un plan gratuit et deux plans payants, Solo et
          Team, ainsi que des packs de tokens pour le scan de site, achetés
          séparément. Le détail des plans, de leurs limites et de leurs prix
          en euros est disponible sur la page{" "}
          <Link href="/pricing" className="text-foreground underline underline-offset-2">
            Tarifs
          </Link>
          , seule référence à jour.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          3. Paiement et durée
        </h2>
        <p>
          Le paiement est géré par notre prestataire Stripe. Les abonnements
          Solo et Team sont facturés mensuellement avec reconduction tacite ;
          les packs de tokens sont des achats ponctuels, non récurrents. Vous
          pouvez résilier votre abonnement à tout moment depuis le portail
          client Stripe (Paramètres → Abonnement), sans engagement ni
          préavis ; la résiliation prend effet à la fin de la période déjà
          payée.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          4. Exécution du service
        </h2>
        <p>
          L&apos;accès aux fonctionnalités du plan souscrit est activé
          immédiatement après confirmation du paiement par Stripe.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          5. Droit de rétractation (14 jours)
        </h2>
        <p>
          Conformément aux articles L221-18 et suivants du Code de la
          consommation, si vous êtes un consommateur, vous disposez d&apos;un
          délai de 14 jours à compter de la souscription pour exercer votre
          droit de rétractation, sans avoir à justifier de motif.
        </p>
        <p>
          PostShip étant un contenu/service numérique fourni immédiatement :
          en demandant l&apos;accès dès la souscription, vous consentez
          expressément à cette exécution immédiate et reconnaissez renoncer
          à votre droit de rétractation pour la part du service déjà
          exécutée. En pratique :
        </p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            Les tokens déjà consommés (scans déjà effectués) ne sont pas
            remboursables.
          </li>
          <li>
            Le solde de tokens non consommé, ou la part d&apos;abonnement
            correspondant à la période non encore utilisée, reste
            remboursable si la rétractation est exercée dans les 14 jours
            suivant l&apos;achat.
          </li>
        </ul>
        <p>
          Pour exercer ce droit, envoyez le formulaire ci-dessous à{" "}
          <a
            href={`mailto:${contactEmail}`}
            className="text-foreground underline underline-offset-2"
          >
            {contactEmail}
          </a>
          :
        </p>
        <div className="rounded border border-border p-4 text-xs">
          <p>Je notifie ma rétractation du contrat portant sur :</p>
          <p className="mt-2">— Nom :</p>
          <p>— Email du compte :</p>
          <p>— Date de commande :</p>
          <p className="mt-2">« Je notifie ma rétractation. »</p>
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">6. Médiation</h2>
        {LEGAL.mediator.name === "FIXME_LEGAL" ? (
          <p>
            Les coordonnées du médiateur de la consommation seront publiées
            dès adhésion à un médiateur référencé par la Commission
            d&apos;évaluation et de contrôle de la médiation de la
            consommation (CECMC).
          </p>
        ) : (
          <p>
            En cas de litige, vous pouvez recourir gratuitement au médiateur
            de la consommation : {LEGAL.mediator.name} —{" "}
            <a
              href={LEGAL.mediator.url}
              target="_blank"
              rel="noreferrer noopener"
              className="text-foreground underline underline-offset-2"
            >
              {LEGAL.mediator.url}
            </a>
            .
          </p>
        )}
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          7. Droit applicable
        </h2>
        <p>
          Les présentes CGV sont soumises au droit français. Tout litige
          relève de la compétence des tribunaux français, sous réserve des
          dispositions impératives applicables aux consommateurs, qui
          conservent le bénéfice de la juridiction de leur domicile.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          8. Modification des CGV
        </h2>
        <p>
          Nous pouvons modifier les présentes CGV ; toute modification
          substantielle vous sera notifiée par email au moins 30 jours avant
          son entrée en vigueur.
        </p>
      </section>
    </div>
  );
}
