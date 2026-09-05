import { Cell, Panel, Row, Table, Tag } from "@/components/admin/console-ui";
import { getAuditLog } from "@/lib/admin";

export const metadata = { title: "Journal" };
export const dynamic = "force-dynamic";

function tone(action: string): "neutral" | "good" | "warn" | "bad" {
  if (action.endsWith(".success") || action === "logout") return "good";
  if (action.endsWith(".failed") || action.endsWith(".locked")) return "bad";
  if (action.startsWith("login.")) return "warn";
  return "neutral";
}

export default async function ConsoleAudit() {
  const entries = await getAuditLog();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-mono text-sm text-neutral-100">Journal d&apos;audit</h1>

      <Panel>
        <Table
          head={["Quand", "Opérateur", "Action", "Cible", "IP", "Détail"]}
          empty={entries.length === 0}
        >
          {entries.map((e) => (
            <Row key={e.id}>
              <Cell className="whitespace-nowrap text-neutral-500">
                {new Date(e.created_at).toLocaleString("fr-FR")}
              </Cell>
              <Cell>{e.username ?? "—"}</Cell>
              <Cell>
                <Tag tone={tone(e.action)}>{e.action}</Tag>
              </Cell>
              <Cell className="break-all text-neutral-400">{e.target ?? "—"}</Cell>
              <Cell className="text-neutral-600">{e.ip ?? "—"}</Cell>
              <Cell className="break-all text-neutral-600">
                {e.detail ? JSON.stringify(e.detail) : "—"}
              </Cell>
            </Row>
          ))}
        </Table>
      </Panel>

      <p className="font-mono text-[0.65rem] text-neutral-700">
        Chaque tentative de connexion, réussie ou non, et chaque action
        privilégiée. Un panneau d&apos;administration sans trace est une
        machine à alibis.
      </p>
    </div>
  );
}
