import Link from "next/link";

export const metadata = {
  title: "Mentions légales",
  description: "Mentions légales de PostShip.",
};

export default function MentionsLegalesPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6 px-6 py-16 text-sm text-muted-foreground">
      <Link href="/" className="text-xs hover:text-foreground hover:underline">
        ← Retour
      </Link>

      <div>
        <h1 className="text-lg font-semibold text-foreground">
          Mentions légales
        </h1>
        <p className="mt-1 text-xs">Dernière mise à jour : 2 septembre 2026</p>
      </div>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">Éditeur</h2>
        <p>
          Le site postship.fr est édité par Thibault Morretton, exerçant à
          titre individuel, domicilié au 19 Route de Lyon, 42400
          Saint-Chamond, France.
        </p>
        <p>
          Contact :{" "}
          <a
            href="mailto:tmorretton@gmail.com"
            className="text-foreground underline underline-offset-2"
          >
            tmorretton@gmail.com
          </a>
        </p>
        <p>
          Directeur de la publication : Thibault Morretton.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">Hébergement</h2>
        <p>
          Application hébergée par Vercel Inc. —{" "}
          <a
            href="https://vercel.com"
            target="_blank"
            rel="noreferrer noopener"
            className="text-foreground underline underline-offset-2"
          >
            vercel.com
          </a>
          .
        </p>
        <p>
          Base de données et authentification hébergées par Supabase (Union
          Européenne).
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          Propriété intellectuelle
        </h2>
        <p>
          L&apos;ensemble du contenu du site (textes, marque, logo) est la
          propriété de l&apos;éditeur, sauf mention contraire.
        </p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">
          Données personnelles
        </h2>
        <p>
          Le traitement de vos données personnelles est détaillé dans la{" "}
          <Link
            href="/privacy"
            className="text-foreground underline underline-offset-2"
          >
            politique de confidentialité
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
