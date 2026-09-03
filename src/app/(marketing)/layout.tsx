import Link from "next/link";
import { MarketingHeader } from "./marketing-header";

const FOOTER_LINK_CLASS =
  "w-fit rounded-full text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 text-xs text-muted-foreground sm:grid-cols-3 sm:px-10">
          <nav aria-label="Produit" className="flex flex-col gap-2">
            <p className="font-medium text-foreground">Produit</p>
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
          </nav>
          <nav aria-label="Légal" className="flex flex-col gap-2">
            <p className="font-medium text-foreground">Légal</p>
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
          </nav>
          <div className="flex items-end sm:justify-end">
            <span>© {new Date().getFullYear()} PostShip</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
