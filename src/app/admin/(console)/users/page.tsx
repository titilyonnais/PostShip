import { Cell, Panel, Row, Table, Tag } from "@/components/admin/console-ui";
import { getAdminUsers } from "@/lib/admin";
import { formatRelativeTime } from "@/lib/format-relative-time";

export const metadata = { title: "Utilisateurs" };
export const dynamic = "force-dynamic";

export default async function ConsoleUsers() {
  const users = await getAdminUsers();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="font-mono text-sm text-neutral-100">
        Utilisateurs <span className="text-neutral-600">({users.length})</span>
      </h1>

      <Panel>
        <Table
          head={["Compte", "Plan", "Abonnement", "Projets", "URLs", "Tokens", "Vu", "Inscrit"]}
          empty={users.length === 0}
        >
          {users.map((u) => (
            <Row key={u.id}>
              <Cell>
                <span className="text-neutral-200">{u.email ?? "—"}</span>
                {u.username && (
                  <span className="block text-[0.65rem] text-neutral-600">@{u.username}</span>
                )}
              </Cell>
              <Cell>
                <Tag tone={u.plan === "free" || !u.plan ? "neutral" : "good"}>
                  {u.plan ?? "free"}
                </Tag>
              </Cell>
              <Cell>
                {u.stripe_subscription_status ? (
                  <Tag
                    tone={
                      u.stripe_subscription_status === "active"
                        ? "good"
                        : u.stripe_subscription_status === "past_due"
                          ? "bad"
                          : "warn"
                    }
                  >
                    {u.stripe_subscription_status}
                  </Tag>
                ) : (
                  <span className="text-neutral-700">—</span>
                )}
              </Cell>
              <Cell>{u.projects}</Cell>
              <Cell>{u.targets}</Cell>
              <Cell>{u.token_balance ?? 0}</Cell>
              <Cell className="text-neutral-500">
                {u.last_seen_at ? formatRelativeTime(u.last_seen_at) : "jamais"}
              </Cell>
              <Cell className="text-neutral-500">
                {new Date(u.created_at).toLocaleDateString("fr-FR")}
              </Cell>
            </Row>
          ))}
        </Table>
      </Panel>

      <p className="font-mono text-[0.65rem] text-neutral-700">
        Lecture seule, et pas d&apos;usurpation d&apos;identité : « se connecter
        en tant que » est la fonction la plus dangereuse qu&apos;un panneau
        d&apos;administration puisse offrir, et tout ce qu&apos;un cas de
        support demande réellement est déjà sur la ligne.
      </p>
    </div>
  );
}
