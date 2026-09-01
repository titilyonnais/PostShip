import Link from "next/link";

export const metadata = {
  title: "Confidentialité — PostShip",
  description: "Politique de confidentialité de PostShip.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 px-6 py-16 text-sm text-muted-foreground">
      <Link href="/" className="text-xs hover:text-foreground hover:underline">
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
    </div>
  );
}
