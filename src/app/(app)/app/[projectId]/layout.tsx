import { notFound } from "next/navigation";
import { getProject } from "@/lib/db/loaders";

// B1 (app-bar backlog): the project name, pause badge, "Lancer maintenant"
// and status line used to live here, repeated identically on every project
// page — they're now the app-bar's switcher (name + status dot) and its
// per-page contextual action. LastChecked + the pause badge moved into the
// Aperçu page body specifically (see page.tsx) rather than disappearing —
// they're still genuinely useful there, just not duplicated on every tab.
export default async function ProjectLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProject(projectId);
  if (!project) notFound();

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      {children}
    </div>
  );
}
