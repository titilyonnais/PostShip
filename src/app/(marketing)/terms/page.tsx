import Link from "next/link";

export const metadata = {
  title: "CGU",
  description: "Conditions générales d'utilisation de PostShip.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16 text-sm text-muted-foreground">
      <Link href="/" className="text-xs hover:text-foreground hover:underline">
        ← Retour
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-foreground">
          Conditions générales d&apos;utilisation
        </h1>
        <p className="mt-1 text-xs">Dernière mise à jour : 1er septembre 2026</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">1. Objet</h2>
        <p>
          Les présentes conditions générales d&apos;utilisation (CGU)
          régissent l&apos;accès et l&apos;utilisation du service PostShip,
          accessible à l&apos;adresse postship.fr, édité par Thibault
          Morretton, 19 Route de Lyon, 42400 Saint-Chamond, France. Toute
          création de compte implique l&apos;acceptation pleine et entière
          des présentes CGU.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          2. Description du service
        </h2>
        <p>
          PostShip est un service de surveillance post-déploiement : il
          vérifie périodiquement, comme le ferait un visiteur, l&apos;état
          des URLs que vous configurez (statut HTTP, aperçu réseaux sociaux,
          sitemap, certificat SSL, page de succès Stripe) et vous alerte par
          email et/ou Discord en cas d&apos;anomalie détectée, silencieux
          tant que tout fonctionne.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          3. Inscription et compte
        </h2>
        <p>
          L&apos;utilisation de PostShip nécessite la création d&apos;un
          compte (lien magique, email et mot de passe, ou connexion
          Google/GitHub) et la fourniture d&apos;informations exactes. Vous
          êtes seul responsable de la confidentialité de vos identifiants et
          de toute activité effectuée depuis votre compte.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          4. Plans et tarifs
        </h2>
        <p>
          PostShip propose un plan gratuit et des plans payants (Solo,
          Team), détaillés sur la page{" "}
          <Link href="/pricing" className="text-foreground underline underline-offset-2">
            Tarifs
          </Link>
          . Le paiement récurrent est géré par Stripe. Vous pouvez changer de
          plan ou résilier à tout moment depuis Paramètres → Abonnement, sans
          engagement ni préavis ; le changement est proraté par Stripe. Les
          conditions de vente détaillées (facturation, rétractation) sont
          définies dans les{" "}
          <Link href="/cgv" className="text-foreground underline underline-offset-2">
            CGV
          </Link>
          .
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">5. Tokens</h2>
        <p>
          Le scan complet d&apos;un site consomme des tokens, achetés
          séparément par pack et indépendants de l&apos;abonnement. Les
          tokens n&apos;expirent pas. Les tokens déjà consommés ne sont pas
          remboursables ; le solde non consommé peut l&apos;être dans les
          conditions du droit de rétractation prévu par les{" "}
          <Link href="/cgv" className="text-foreground underline underline-offset-2">
            CGV
          </Link>
          .
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          6. Obligations de l&apos;utilisateur
        </h2>
        <p>Vous vous engagez à :</p>
        <ul className="flex list-disc flex-col gap-1 pl-5">
          <li>
            N&apos;utiliser PostShip que pour surveiller des sites dont vous
            êtes propriétaire ou légitimement autorisé à surveiller
          </li>
          <li>
            Ne pas utiliser le service pour scanner, sonder ou perturber des
            systèmes tiers sans autorisation
          </li>
          <li>
            Ne pas contourner les limites techniques du service (quotas,
            fréquence de vérification)
          </li>
        </ul>
        <p>
          Tout usage abusif peut entraîner la suspension immédiate du
          compte.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          7. Disponibilité et responsabilité
        </h2>
        <p>
          PostShip est fourni « en l&apos;état ». Nous mettons en œuvre des
          moyens raisonnables pour assurer la disponibilité du service mais
          ne garantissons pas une disponibilité de 100 %. PostShip ne saurait
          être tenu responsable des conséquences d&apos;une panne du site
          surveillé, d&apos;un retard ou d&apos;une absence d&apos;alerte, ni
          des décisions prises sur la base des informations fournies par le
          service.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          8. Propriété intellectuelle
        </h2>
        <p>
          PostShip, sa marque et son contenu restent la propriété exclusive
          de l&apos;éditeur. Vous conservez l&apos;intégralité des droits
          sur vos propres données et le contenu de vos projets.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          9. Résiliation
        </h2>
        <p>
          Vous pouvez résilier votre abonnement ou supprimer votre compte à
          tout moment, sans frais ni préavis, depuis votre espace. Nous nous
          réservons le droit de suspendre ou résilier un compte en cas de
          violation des présentes CGU.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          10. Droit applicable
        </h2>
        <p>
          Les présentes CGU sont soumises au droit français. Tout litige
          relève de la compétence des tribunaux français, sous réserve des
          dispositions impératives applicables aux consommateurs.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          11. Modification des CGU
        </h2>
        <p>
          Nous pouvons modifier les présentes CGU ; toute modification
          substantielle vous sera notifiée par email au moins 30 jours avant
          son entrée en vigueur.
        </p>
      </section>
    </div>
  );
}
