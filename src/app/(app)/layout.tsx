import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { avatarUrl } from "@/lib/avatar";
import {
  getAuthUser,
  getOpenIncidentCounts,
  getProfile,
  getUserProjects,
} from "@/lib/db/loaders";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  const [profile, projects, openIncidentCounts] = await Promise.all([
    getProfile(user.id),
    getUserProjects(),
    getOpenIncidentCounts(),
  ]);

  return (
    <div className="min-h-screen">
      <a
        href="#app-main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Aller au contenu
      </a>

      <AppSidebar
        projects={projects}
        openIncidentCounts={openIncidentCounts}
        profile={{
          displayName:
            profile?.username || profile?.display_name || user.email || "Compte",
          email: profile?.email ?? user.email ?? "",
          avatarUrl: avatarUrl(profile?.avatar_seed ?? user.id),
        }}
      />

      <main id="app-main" className="min-w-0 overflow-x-hidden p-6 md:ml-60">
        {children}
      </main>
    </div>
  );
}
