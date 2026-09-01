import { redirect } from "next/navigation";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import { avatarUrl } from "@/lib/avatar";
import { createClient } from "@/lib/db/server";

export default async function AppLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const [{ data: profile }, { data: projects }] = await Promise.all([
    supabase
      .from("profiles")
      .select("username, display_name, email, avatar_seed")
      .eq("id", user.id)
      .single(),
    supabase
      .from("projects")
      .select("id, name, base_url, last_status")
      .order("created_at"),
  ]);

  return (
    <div className="min-h-screen">
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:text-primary-foreground"
      >
        Aller au contenu
      </a>

      <AppSidebar
        projects={projects ?? []}
        profile={{
          displayName:
            profile?.username || profile?.display_name || user.email || "Compte",
          email: profile?.email ?? user.email ?? "",
          avatarUrl: avatarUrl(profile?.avatar_seed ?? user.id),
        }}
      />

      <main id="main" className="p-6 md:ml-60">
        {children}
      </main>
    </div>
  );
}
