import { Panel } from "@/components/admin/console-ui";
import { getAdminProjects } from "@/lib/admin";
import { ProjectsTable } from "./projects-table";

export const metadata = { title: "Projets" };
export const dynamic = "force-dynamic";

export default async function ConsoleProjects() {
  const projects = await getAdminProjects();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-mono text-sm text-neutral-100">
        Projets <span className="text-neutral-600">({projects.length})</span>
      </h1>

      <Panel>
        <ProjectsTable projects={projects} />
      </Panel>
    </div>
  );
}
