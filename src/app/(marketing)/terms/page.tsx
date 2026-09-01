import Link from "next/link";

export const metadata = {
  title: "CGU — PostShip",
  description: "Conditions générales d'utilisation de PostShip.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-16 text-sm text-muted-foreground">
      <Link href="/" className="text-xs hover:text-foreground hover:underline">
        ← Retour
      </Link>
      <h1 className="text-lg font-semibold text-foreground">
        Conditions générales d&apos;utilisation
      </h1>
      <p>
        TODO-LEGAL — cette page est un stub. Le texte définitif (objet du
        service, tarifs, résiliation, responsabilité, droit applicable) doit
        être rédigé avec un professionnel du droit avant mise en production.
      </p>
    </div>
  );
}
