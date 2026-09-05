import { Cell, Panel, Row, Table, Tag } from "@/components/admin/console-ui";
import { getAdminSession } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/db/service";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { SecurityForms } from "./forms";
import { revokeOtherSessions } from "./actions";

export const metadata = { title: "Sécurité" };
export const dynamic = "force-dynamic";

export default async function ConsoleSecurity() {
  const session = await getAdminSession();
  if (!session) return null;

  const supabase = createServiceClient();
  const [{ data: account }, { data: sessions }] = await Promise.all([
    supabase
      .from("admin_accounts")
      .select("username, totp_enrolled_at, last_login_at, failed_attempts, created_at")
      .eq("id", session.accountId)
      .single(),
    supabase
      .from("admin_sessions")
      .select("id, ip, user_agent, created_at, last_seen_at, expires_at")
      .eq("account_id", session.accountId)
      .is("revoked_at", null)
      .gt("expires_at", new Date().toISOString())
      .order("last_seen_at", { ascending: false }),
  ]);

  const live = sessions ?? [];

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-mono text-sm text-neutral-100">Sécurité du compte</h1>

      <Panel title="Compte">
        <dl className="flex flex-col gap-1.5 font-mono text-xs">
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">Identifiant</dt>
            <dd className="text-neutral-200">{account?.username}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">Authenticator activé</dt>
            <dd>
              {account?.totp_enrolled_at ? (
                <Tag tone="good">
                  {new Date(account.totp_enrolled_at).toLocaleDateString("fr-FR")}
                </Tag>
              ) : (
                <Tag tone="bad">non</Tag>
              )}
            </dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-neutral-500">Dernière connexion</dt>
            <dd className="text-neutral-300">
              {account?.last_login_at ? formatRelativeTime(account.last_login_at) : "—"}
            </dd>
          </div>
        </dl>
      </Panel>

      <SecurityForms />

      <Panel
        title={`Sessions ouvertes (${live.length})`}
        action={
          <form action={revokeOtherSessions}>
            <button
              type="submit"
              className="border border-neutral-800 px-2 py-0.5 font-mono text-[0.65rem] text-neutral-400 hover:border-neutral-700 hover:text-neutral-100"
            >
              Fermer les autres
            </button>
          </form>
        }
      >
        <Table head={["IP", "Client", "Ouverte", "Vue", "Expire"]} empty={live.length === 0}>
          {live.map((s) => (
            <Row key={s.id}>
              <Cell>
                {s.ip ?? "—"}
                {s.id === session.sessionId && (
                  <span className="ml-2 text-[0.65rem] text-[#3fb950]">celle-ci</span>
                )}
              </Cell>
              <Cell className="max-w-[280px] truncate text-neutral-500">
                {s.user_agent ?? "—"}
              </Cell>
              <Cell className="text-neutral-500">{formatRelativeTime(s.created_at)}</Cell>
              <Cell className="text-neutral-500">{formatRelativeTime(s.last_seen_at)}</Cell>
              <Cell className="text-neutral-500">{formatRelativeTime(s.expires_at)}</Cell>
            </Row>
          ))}
        </Table>
      </Panel>
    </div>
  );
}
