import Link from "next/link";
import { Cell, Panel, Row, Table, Tag } from "@/components/admin/console-ui";
import { getAdminUsers } from "@/lib/admin";
import { formatRelativeTime } from "@/lib/format-relative-time";

export const metadata = { title: "Utilisateurs" };
export const dynamic = "force-dynamic";

export default async function ConsoleUsers({
  searchParams,
}: {
  searchParams: Promise<{ risk?: string }>;
}) {
  const { risk } = await searchParams;
  const onlyRisky = risk === "1";

  const all = await getAdminUsers();
  const users = onlyRisky ? all.filter((u) => (u.riskScore ?? 0) > 0) : all;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono text-sm text-neutral-100">
          Utilisateurs <span className="text-neutral-600">({users.length})</span>
        </h1>
        <div className="flex gap-1">
          <Link
            href="/admin/users"
            className={`px-2 py-1 font-mono text-xs ${
              onlyRisky
                ? "text-neutral-500 hover:text-neutral-200"
                : "bg-neutral-800 text-neutral-100"
            }`}
          >
            tous
          </Link>
          <Link
            href="/admin/users?risk=1"
            className={`px-2 py-1 font-mono text-xs ${
              onlyRisky
                ? "bg-neutral-800 text-neutral-100"
                : "text-neutral-500 hover:text-neutral-200"
            }`}
          >
            à risque
          </Link>
        </div>
      </div>

      <Panel>
        <Table
          head={[
            "Compte",
            "Risque",
            "Plan",
            "Abonnement",
            "Projets",
            "URLs",
            "Tokens",
            "Vu",
            "Inscrit",
          ]}
          empty={users.length === 0}
        >
          {users.map((u) => {
            const score = u.riskScore ?? 0;
            return (
              <Row key={u.id}>
                <Cell>
                  <Link
                    href={`/admin/users/${u.id}`}
                    className="text-neutral-200 underline-offset-2 hover:underline"
                  >
                    {u.email ?? u.id}
                  </Link>
                  {u.username && (
                    <span className="block text-[0.65rem] text-neutral-600">@{u.username}</span>
                  )}
                </Cell>
                <Cell>
                  {score >= 40 ? (
                    <Tag tone="bad">{score}</Tag>
                  ) : score > 0 ? (
                    <Tag tone="warn">{score}</Tag>
                  ) : (
                    <span className="text-neutral-700">—</span>
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
            );
          })}
        </Table>
      </Panel>

      <p className="font-mono text-[0.65rem] text-neutral-700">
        Le score de la liste ne compte que les signaux présents en base plus
        l&apos;impayé : les signaux Stripe coûteraient un appel par ligne.
        Ouvrez une fiche pour le score complet. Pas d&apos;usurpation
        d&apos;identité.
      </p>
    </div>
  );
}
