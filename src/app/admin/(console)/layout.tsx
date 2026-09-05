import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminSession, revokeAdminSession, auditLog } from "@/lib/admin-auth";

export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Vue d'ensemble" },
  { href: "/admin/users", label: "Utilisateurs" },
  { href: "/admin/projects", label: "Projets" },
  { href: "/admin/revenue", label: "Revenu" },
  { href: "/admin/system", label: "Système" },
  { href: "/admin/audit", label: "Journal" },
  { href: "/admin/security", label: "Sécurité" },
];

async function signOut() {
  "use server";
  const session = await getAdminSession();
  if (session) {
    await auditLog({
      accountId: session.accountId,
      username: session.username,
      action: "logout",
    });
  }
  await revokeAdminSession();
  redirect("/admin/login");
}

export default async function ConsoleLayout({ children }: { children: React.ReactNode }) {
  // The only gate. Every page under this layout is a Server Component, so
  // there is no client route that could render before it resolves.
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-10 border-b border-neutral-900 bg-[#08090b]/95 backdrop-blur">
        <div className="mx-auto flex w-full max-w-[1400px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/admin" className="font-mono text-sm text-neutral-100">
            postship <span className="text-[#3fb950]">/ console</span>
          </Link>

          <nav className="flex flex-wrap items-center gap-1">
            {NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded px-2 py-1 font-mono text-xs text-neutral-500 transition-colors hover:bg-neutral-900 hover:text-neutral-100"
              >
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <span className="font-mono text-xs text-neutral-600">{session.username}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="rounded border border-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400 transition-colors hover:border-neutral-700 hover:text-neutral-100"
              >
                Fermer la session
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1400px] flex-1 px-4 py-6">{children}</main>

      <footer className="border-t border-neutral-900 px-4 py-3">
        <p className="mx-auto max-w-[1400px] font-mono text-[0.65rem] text-neutral-700">
          Session inactive fermée après 30 min · expiration absolue 8 h · toute
          action est journalisée
        </p>
      </footer>
    </div>
  );
}
