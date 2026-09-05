import Link from "next/link";
import { Cell, Metric, Panel, Row, Table, Tag } from "@/components/admin/console-ui";
import {
  formatBytes,
  getAuthOverview,
  getDatabaseOverview,
  getSupabaseProject,
} from "@/lib/admin-supabase";
import { formatRelativeTime } from "@/lib/format-relative-time";

export const metadata = { title: "Supabase" };
export const dynamic = "force-dynamic";

export default async function ConsoleSupabase() {
  // Three independent sources: the Management API can be down while the
  // database is perfectly reachable, and vice versa.
  // The dashboard has no stable per-user URL, so the button opens the
  // project's user list; the row's own name is the deep link into our
  // file, which does exist.
  const supabaseRef = process.env.SUPABASE_PROJECT_REF ?? null;

  const [project, auth, db] = await Promise.all([
    getSupabaseProject(),
    getAuthOverview(),
    getDatabaseOverview(),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-mono text-sm text-neutral-100">Supabase</h1>

      <Panel title="Projet">
        {!project.configured ? (
          <p className="font-mono text-xs text-neutral-600">
            Jeton absent — variables{" "}
            <span className="text-neutral-400">
              SUPABASE_MANAGEMENT_TOKEN + SUPABASE_PROJECT_REF
            </span>
            .
          </p>
        ) : project.error ? (
          <Tag tone="bad">{project.error}</Tag>
        ) : (
          <dl className="flex flex-col gap-1.5 font-mono text-xs">
            {[
              ["Nom", project.name],
              ["État", project.status],
              ["Région", project.region],
              ["PostgreSQL", project.postgresVersion],
              ["Hôte", project.host],
              [
                "Créé le",
                project.createdAt
                  ? new Date(project.createdAt).toLocaleDateString("fr-FR")
                  : null,
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-neutral-500">{label}</dt>
                <dd
                  className={
                    label === "État" && value === "ACTIVE_HEALTHY"
                      ? "text-[#3fb950]"
                      : "break-all text-neutral-200"
                  }
                >
                  {value ?? "—"}
                </dd>
              </div>
            ))}
          </dl>
        )}
      </Panel>

      <div className="flex flex-col gap-3">
        <h2 className="font-mono text-[0.7rem] tracking-[0.15em] text-neutral-500 uppercase">
          Authentification
        </h2>
        {!auth.ok ? (
          <Panel>
            <Tag tone="bad">
              L&apos;API Auth n&apos;a pas répondu — vérifiez la clé service role.
            </Tag>
          </Panel>
        ) : (
          <>
            <div className="grid gap-px bg-neutral-900 sm:grid-cols-3">
              <Metric label="Comptes" value={String(auth.total)} />
              <Metric
                label="Email confirmé"
                value={String(auth.confirmed)}
                hint={`${auth.total - auth.confirmed} en attente`}
              />
              <Metric
                label="Bannis"
                value={String(auth.banned)}
                tone={auth.banned > 0 ? "warn" : "default"}
                hint="ban encore actif"
              />
            </div>

            <Panel title="Dernières connexions">
              <Table
                head={["Compte", "Dernière connexion", ""]}
                empty={auth.recent.length === 0}
              >
                {auth.recent.map((u) => (
                  <Row key={u.id}>
                    <Cell>
                      {/* The name was a dead end: seeing who signed in is
                          only useful if you can then open their file. */}
                      <Link
                        href={`/admin/users/${u.id}`}
                        className="text-neutral-200 underline-offset-2 hover:underline"
                      >
                        {u.email ?? u.id}
                      </Link>
                    </Cell>
                    <Cell className="text-neutral-500">
                      {u.lastSignInAt ? formatRelativeTime(u.lastSignInAt) : "jamais"}
                    </Cell>
                    <Cell>
                      {/* This page is about Supabase, so its button goes to
                          Supabase. The account name beside it already links
                          to our own file — two destinations, each where the
                          label says. */}
                      {project.configured && supabaseRef ? (
                        <a
                          href={`https://supabase.com/dashboard/project/${supabaseRef}/auth/users`}
                          target="_blank"
                          rel="noreferrer"
                          className="border border-neutral-800 px-2 py-0.5 text-[0.65rem] text-neutral-400 hover:border-neutral-600 hover:text-neutral-100"
                        >
                          Supabase ↗
                        </a>
                      ) : (
                        <span className="text-neutral-700">—</span>
                      )}
                    </Cell>
                  </Row>
                ))}
              </Table>
            </Panel>
          </>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <h2 className="font-mono text-[0.7rem] tracking-[0.15em] text-neutral-500 uppercase">
          Base de données
        </h2>

        <div className="grid gap-px bg-neutral-900 sm:grid-cols-2 lg:grid-cols-5">
          <Metric
            label="Service role"
            value={db.serviceRoleOk ? "OK" : "KO"}
            tone={db.serviceRoleOk ? "good" : "bad"}
          />
          <Metric label="Profils" value={String(db.profiles)} />
          <Metric label="Projets" value={String(db.projects)} />
          <Metric label="Checks 24 h" value={db.checkRuns24h.toLocaleString("fr-FR")} />
          <Metric label="Journal 24 h" value={db.opsEvents24h.toLocaleString("fr-FR")} />
        </div>

        <Panel title="Tables les plus lourdes">
          <Table head={["Table", "Taille", "Lignes (estim.)"]} empty={db.tables.length === 0}>
            {db.tables.map((t) => (
              <Row key={t.name}>
                <Cell>{t.name}</Cell>
                <Cell className="text-neutral-400">{formatBytes(t.bytes)}</Cell>
                <Cell className="text-neutral-500">{t.rows.toLocaleString("fr-FR")}</Cell>
              </Row>
            ))}
          </Table>
        </Panel>
      </div>

      <p className="font-mono text-[0.65rem] text-neutral-700">
        Pas d&apos;éditeur SQL et pas de bouton sauvegarde/restauration : les deux
        sont à une faute de frappe d&apos;une panne, et ni l&apos;un ni l&apos;autre
        n&apos;a sa place derrière un simple mot de passe. Le tableau de bord
        Supabase reste la voie pour ça.
      </p>
    </div>
  );
}
