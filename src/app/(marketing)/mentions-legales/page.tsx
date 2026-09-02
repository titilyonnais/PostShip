import Link from "next/link";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Mentions légales",
  description: "Mentions légales de PostShip.",
};

const PENDING = "Information en cours de mise à jour.";

export default function MentionsLegalesPage() {
  const contactEmail =
    LEGAL.email === "FIXME_LEGAL" ? LEGAL.publicEmailFallback : LEGAL.email;

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
          Le site postship.fr est édité par {LEGAL.editorName}, domicilié au{" "}
          {LEGAL.address}.
          {LEGAL.editorStatus !== "FIXME_LEGAL" && (
            <> Statut : entrepreneur individuel (EI).</>
          )}
        </p>
        <p>
          SIRET :{" "}
          {LEGAL.siret === "FIXME_LEGAL" ? PENDING : LEGAL.siret}
        </p>
        <p>
          Contact :{" "}
          <a
            href={`mailto:${contactEmail}`}
            className="text-foreground underline underline-offset-2"
          >
            {contactEmail}
          </a>
          {LEGAL.phone !== "FIXME_LEGAL" && <> — {LEGAL.phone}</>}
        </p>
        <p>Directeur de la publication : {LEGAL.publicationDirector}.</p>
      </section>

      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-medium text-foreground">Hébergement</h2>
        <p>
          Application hébergée par {LEGAL.host.name} —{" "}
          <a
            href={LEGAL.host.url}
            target="_blank"
            rel="noreferrer noopener"
            className="text-foreground underline underline-offset-2"
          >
            {LEGAL.host.url.replace("https://", "")}
          </a>
          {LEGAL.host.address !== "FIXME_LEGAL" && <>, {LEGAL.host.address}</>}
          {LEGAL.host.phone !== "FIXME_LEGAL" && <> — {LEGAL.host.phone}</>}
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
