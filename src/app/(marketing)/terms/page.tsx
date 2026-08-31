import Link from "next/link";

export default function TermsPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8 text-sm text-muted-foreground">
      <Link href="/" className="text-xs underline">
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
    </main>
  );
}
