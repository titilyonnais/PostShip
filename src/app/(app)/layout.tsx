import Link from "next/link";
import { createClient } from "@/lib/db/server";
import { signOut } from "./actions";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Aller au contenu
      </a>
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-5">
          <Link href="/app" className="font-mono text-sm text-foreground">
            PostShip
          </Link>
          {user && (
            <nav aria-label="Principale" className="flex items-center gap-4">
              <Link
                href="/app/billing"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Abonnement
              </Link>
              <Link
                href="/app/account"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Compte
              </Link>
            </nav>
          )}
        </div>
        {user && (
          <form action={signOut} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {user.email}
            </span>
            <button
              type="submit"
              className="text-xs text-muted-foreground transition-colors hover:text-foreground"
            >
              Déconnexion
            </button>
          </form>
        )}
      </header>
      <main id="main" className="p-6">
        {children}
      </main>
    </div>
  );
}
