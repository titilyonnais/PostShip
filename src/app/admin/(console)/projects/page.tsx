import { Cell, Panel, Row, Table, Tag } from "@/components/admin/console-ui";
import { getAdminProjects } from "@/lib/admin";
import { formatRelativeTime } from "@/lib/format-relative-time";

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
        <Table
          head={["Projet", "Propriétaire", "URLs", "En échec", "État", "Dernier check"]}
          empty={projects.length === 0}
        >
          {projects.map((p) => (
            <Row key={p.id}>
              <Cell>
                <span className="text-neutral-200">{p.name}</span>
                <span className="block text-[0.65rem] break-all text-neutral-600">
                  {p.base_url ?? "—"}
                </span>
              </Cell>
              <Cell className="text-neutral-400">{p.owner_email ?? "—"}</Cell>
              <Cell>{p.targets}</Cell>
              <Cell className={p.failing > 0 ? "text-[#f85149]" : ""}>{p.failing}</Cell>
              <Cell>
                {p.paused ? (
                  <Tag tone="warn">en pause</Tag>
                ) : p.failing > 0 ? (
                  <Tag tone="bad">incident</Tag>
                ) : (
                  <Tag tone="good">vert</Tag>
                )}
              </Cell>
              <Cell className="text-neutral-500">
                {p.last_checked_at ? formatRelativeTime(p.last_checked_at) : "jamais"}
              </Cell>
            </Row>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
