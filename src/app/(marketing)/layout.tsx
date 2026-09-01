import Link from "next/link";
import { Logo } from "@/components/logo";
import { NavAuth } from "./nav-auth";

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
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4 sm:px-10">
          <Link href="/">
            <Logo />
          </Link>
          <nav aria-label="Principale" className="flex items-center gap-6">
            <Link
              href="/pricing"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Tarifs
            </Link>
            <Link
              href="/docs"
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              Documentation
            </Link>
            <NavAuth />
          </nav>
        </div>
      </header>

      <main id="main" className="flex-1">
        {children}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center gap-2 px-6 py-6 text-xs text-muted-foreground sm:flex-row sm:justify-between sm:px-10">
          <span>© {new Date().getFullYear()} PostShip</span>
          <nav aria-label="Légal" className="flex gap-4">
            <Link href="/docs" className="hover:text-foreground">
              Documentation
            </Link>
            <Link href="/mentions-legales" className="hover:text-foreground">
              Mentions légales
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Confidentialité
            </Link>
            <Link href="/terms" className="hover:text-foreground">
              CGU
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
