import Link from "next/link";
import { ChevronRight, Rocket } from "lucide-react";
import { StatusDot } from "@/components/status-dot";
import { createClient } from "@/lib/db/server";
import { CreateProjectForm } from "./create-project-form";

export default async function AppHomePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;

  const supabase = await createClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("*")
    .order("created_at");

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <h1 className="text-lg font-semibold">Projets</h1>

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-[#3fb950]">
          {success}
        </p>
      )}

      <CreateProjectForm />

      {projects && projects.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {projects.map((project, index) => (
            <li
              key={project.id}
              className="motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-1"
              style={{ animationDelay: `${Math.min(index, 8) * 40}ms` }}
            >
              <Link
                href={`/app/${project.id}`}
                className="group flex items-center justify-between rounded-md border border-border bg-card px-4 py-3 transition-colors hover:border-foreground/25"
              >
                <div>
                  <p className="text-sm font-medium">{project.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {project.base_url}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StatusDot status={project.last_status} />
                  <ChevronRight
                    className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5"
                    aria-hidden="true"
                  />
                </div>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-12 text-center">
          <Rocket className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Ajoute l’URL de prod</p>
        </div>
      )}
    </div>
  );
}
