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
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-4">
          <Link href="/app" className="font-mono text-sm text-foreground">
            PostShip
          </Link>
          {user && (
            <>
              <Link
                href="/app/billing"
                className="text-xs text-muted-foreground underline"
              >
                Abonnement
              </Link>
              <Link
                href="/app/account"
                className="text-xs text-muted-foreground underline"
              >
                Compte
              </Link>
            </>
          )}
        </div>
        {user && (
          <form action={signOut} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground">
              {user.email}
            </span>
            <button
              type="submit"
              className="text-xs text-muted-foreground underline"
            >
              Déconnexion
            </button>
          </form>
        )}
      </header>
      <div className="p-6">{children}</div>
    </div>
  );
}
