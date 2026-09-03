import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { NavAuth } from "./nav-auth";

const HEADER_LINK_CLASS =
  "rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

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
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
          <Link href="/" aria-label="PostShip, accueil">
            <LogoMark className="size-9" />
          </Link>
          <nav aria-label="Principale" className="flex items-center gap-2">
            <Link href="/pricing" className={HEADER_LINK_CLASS}>
              Tarifs
            </Link>
            <Link href="/docs" className={HEADER_LINK_CLASS}>
              Documentation
            </Link>
            <NavAuth />
            <span className="hidden md:inline-flex">
              <Link
                href="/login?plan=free"
                className={buttonVariants({ variant: "default" })}
              >
                Commencer
              </Link>
            </span>
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto grid max-w-6xl gap-8 px-6 py-10 text-xs text-muted-foreground sm:grid-cols-3 sm:px-10">
          <nav aria-label="Produit" className="flex flex-col gap-2">
            <p className="font-medium text-foreground">Produit</p>
            <Link href="/pricing" className={FOOTER_LINK_CLASS}>
              Tarifs
            </Link>
            <Link href="/docs" className={FOOTER_LINK_CLASS}>
              Documentation
            </Link>
            <Link href="/login" className={FOOTER_LINK_CLASS}>
              Connexion
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
