import Link from "next/link";

export default function PrivacyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-4 p-8 text-sm text-muted-foreground">
      <Link href="/" className="text-xs underline">
        ← Retour
      </Link>
      <h1 className="text-lg font-semibold text-foreground">
        Politique de confidentialité
      </h1>
      <p>
        TODO-LEGAL — cette page est un stub. Le texte définitif (données
        collectées, base légale, durée de conservation, sous-traitants,
        droits RGPD) doit être rédigé avec un professionnel du droit avant
        mise en production.
      </p>
    </main>
  );
}
