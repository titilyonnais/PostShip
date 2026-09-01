import Link from "next/link";
import { Logo } from "@/components/logo";
import { avatarUrl } from "@/lib/avatar";
import { createClient } from "@/lib/db/server";
import { UserMenu } from "./user-menu";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = user
    ? await supabase
        .from("profiles")
        .select("username, display_name, email, avatar_seed")
        .eq("id", user.id)
        .single()
    : { data: null };

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Aller au contenu
      </a>
      <header className="flex items-center justify-between border-b border-border px-6 py-3">
        <div className="flex items-center gap-6">
          <Link href="/app">
            <Logo />
          </Link>
          {user && (
            <nav aria-label="Principale" className="flex items-center gap-4">
              <Link
                href="/app"
                className="text-xs text-muted-foreground transition-colors hover:text-foreground"
              >
                Projets
              </Link>
            </nav>
          )}
        </div>
        {user && (
          <UserMenu
            displayName={
              profile?.username || profile?.display_name || user.email || "Compte"
            }
            email={profile?.email ?? user.email ?? ""}
            avatarUrl={avatarUrl(profile?.avatar_seed ?? user.id)}
          />
        )}
      </header>
      <main id="main" className="p-6">
        {children}
      </main>
    </div>
  );
}
