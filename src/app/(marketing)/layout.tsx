import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { MarketingHeader } from "./marketing-header";

const FOOTER_LINK_CLASS =
  "w-fit rounded-full text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function FooterColumn({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <nav aria-label={label} className="flex flex-col gap-2.5">
      <p className="text-xs font-medium tracking-wide text-foreground uppercase">{label}</p>
      {children}
    </nav>
  );
}

export default function MarketingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Aller au contenu
      </a>
      <MarketingHeader />

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border bg-card/40">
        <div className="mx-auto grid max-w-7xl gap-10 px-6 py-14 sm:grid-cols-[1.3fr_1fr_1fr_1fr] sm:px-10">
          <div className="flex flex-col gap-3">
            <Link href="/" aria-label="PostShip, accueil" className="flex items-center gap-2">
              <LogoMark className="size-7" />
              <span className="text-sm font-semibold tracking-tight text-foreground">
                PostShip
              </span>
            </Link>
            <p className="max-w-56 text-sm text-muted-foreground">
              Surveillance post-déploiement pour sites et SaaS indie. Vérifié
              comme un vrai visiteur, alerté seulement si ça casse.
            </p>
          </div>

          <FooterColumn label="Produit">
            <Link href="/produit" className={FOOTER_LINK_CLASS}>
              Produit
            </Link>
            <Link href="/pricing" className={FOOTER_LINK_CLASS}>
              Tarifs
            </Link>
            <Link href="/docs" className={FOOTER_LINK_CLASS}>
              Documentation
            </Link>
            <Link href="/changelog" className={FOOTER_LINK_CLASS}>
              Journal
            </Link>
          </FooterColumn>

          <FooterColumn label="Compte">
            <Link href="/login" className={FOOTER_LINK_CLASS}>
              Connexion
            </Link>
            <Link href="/pricing" className={FOOTER_LINK_CLASS}>
              Créer un compte
            </Link>
          </FooterColumn>

          <FooterColumn label="Légal">
            <Link href="/mentions-legales" className={FOOTER_LINK_CLASS}>
              Mentions légales
            </Link>
            <Link href="/privacy" className={FOOTER_LINK_CLASS}>
              Confidentialité
            </Link>
            <Link href="/terms" className={FOOTER_LINK_CLASS}>
              CGU
            </Link>
            <Link href="/cgv" className={FOOTER_LINK_CLASS}>
              CGV
            </Link>
          </FooterColumn>
        </div>

        <div className="border-t border-border">
          <div className="mx-auto flex max-w-7xl flex-col-reverse items-center justify-between gap-2 px-6 py-4 text-xs text-muted-foreground sm:flex-row sm:px-10">
            <span>© {new Date().getFullYear()} PostShip. Tous droits réservés.</span>
            <span>Fait pour les indie hackers et les petites équipes.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
