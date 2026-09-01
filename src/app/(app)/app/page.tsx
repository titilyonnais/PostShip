import Link from "next/link";
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
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-destructive">{error}</p>}
      {success && <p className="text-sm text-emerald-500">{success}</p>}

      <CreateProjectForm />

      {projects && projects.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {projects.map((project) => (
            <li key={project.id}>
              <Link
                href={`/app/${project.id}`}
                className="flex items-center justify-between border border-border px-4 py-3 hover:border-foreground/30"
              >
                <div>
                  <p className="text-sm font-medium">{project.name}</p>
                  <p className="font-mono text-xs text-muted-foreground">
                    {project.base_url}
                  </p>
                </div>
                <StatusDot status={project.last_status} />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Ajoute l’URL de prod</p>
      )}
    </div>
  );
}
