import Link from "next/link";
import { notFound } from "next/navigation";
import { Cell, Metric, Panel, Row, Table, Tag } from "@/components/admin/console-ui";
import { createServiceClient } from "@/lib/db/service";
import { formatRelativeTime } from "@/lib/format-relative-time";
import { PauseButton } from "./pause-button";

export const metadata = { title: "Projet" };
export const dynamic = "force-dynamic";

type TargetRow = {
  id: string;
  url: string;
  kind: string;
  enabled: boolean;
  last_outcome: string | null;
  last_started_at: string | null;
};

export default async function ConsoleProjectDetail({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, base_url, paused, last_status, last_checked_at, created_at, user_id")
    .eq("id", id)
    .maybeSingle();

  if (!project) notFound();

  const [{ data: owner }, { data: targets }] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, email, plan")
      .eq("id", project.user_id)
      .maybeSingle(),
    supabase
      .from("check_targets")
      .select("id, url, kind, enabled, last_outcome, last_started_at")
      .eq("project_id", id)
      .order("created_at"),
  ]);

  const rows = (targets ?? []) as TargetRow[];
  const failing = rows.filter(
    (t) => t.enabled && (t.last_outcome === "fail" || t.last_outcome === "error"),
  );

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <Link
            href="/admin/projects"
            className="font-mono text-xs text-neutral-600 hover:text-neutral-300"
          >
            ← projets
          </Link>
          <h1 className="font-mono text-sm text-neutral-100">{project.name}</h1>
        </div>
        <div className="flex items-center gap-2">
          {project.paused ? (
            <Tag tone="warn">en pause</Tag>
          ) : failing.length > 0 ? (
            <Tag tone="bad">incident</Tag>
          ) : (
            <Tag tone="good">vert</Tag>
          )}
        </div>
      </div>

      <Panel title="Projet">
        <div className="flex flex-col gap-4">
          <dl className="grid gap-1.5 font-mono text-xs sm:grid-cols-2">
            {[
              ["Identifiant", project.id],
              ["Domaine", project.base_url ?? "—"],
              ["Propriétaire", owner?.email ?? project.user_id],
              ["Plan du propriétaire", owner?.plan ?? "free"],
              ["Dernier état", project.last_status ?? "—"],
              [
                "Dernière vérification",
                project.last_checked_at
                  ? formatRelativeTime(project.last_checked_at)
                  : "jamais",
              ],
              [
                "Créé",
                project.created_at
                  ? new Date(project.created_at).toLocaleDateString("fr-FR")
                  : "—",
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex justify-between gap-3">
                <dt className="text-neutral-500">{label}</dt>
                <dd className="break-all text-neutral-200">{value}</dd>
              </div>
            ))}
          </dl>

          {owner && (
            <Link
              href={`/admin/users/${owner.id}`}
              className="self-start font-mono text-xs text-neutral-500 underline underline-offset-2 hover:text-neutral-200"
            >
              ouvrir la fiche du propriétaire →
            </Link>
          )}

          <PauseButton projectId={project.id} paused={Boolean(project.paused)} />
        </div>
      </Panel>

      <div className="grid gap-px bg-neutral-900 sm:grid-cols-3">
        <Metric label="URLs" value={String(rows.length)} />
        <Metric
          label="Actives"
          value={String(rows.filter((t) => t.enabled).length)}
        />
        <Metric
          label="En échec"
          value={String(failing.length)}
          tone={failing.length > 0 ? "bad" : "good"}
        />
      </div>

      <Panel title="URLs surveillées">
        <Table head={["URL", "Type", "État", "Dernier run"]} empty={rows.length === 0}>
          {rows.map((t) => (
            <Row key={t.id}>
              <Cell className="break-all">{t.url}</Cell>
              <Cell className="text-neutral-500">{t.kind}</Cell>
              <Cell>
                {!t.enabled ? (
                  <Tag>désactivée</Tag>
                ) : t.last_outcome === "pass" ? (
                  <Tag tone="good">pass</Tag>
                ) : t.last_outcome ? (
                  <Tag tone="bad">{t.last_outcome}</Tag>
                ) : (
                  <Tag>jamais</Tag>
                )}
              </Cell>
              <Cell className="text-neutral-500">
                {t.last_started_at ? formatRelativeTime(t.last_started_at) : "—"}
              </Cell>
            </Row>
          ))}
        </Table>
      </Panel>

      <p className="font-mono text-[0.65rem] text-neutral-700">
        Pause / reprise est la seule écriture possible ici. Pas de
        suppression — c&apos;est la surveillance de quelqu&apos;un, et un
        mauvais clic serait irrécupérable — et pas d&apos;édition des secrets
        d&apos;intégration, que la console n&apos;a pas à lire.
      </p>
    </div>
  );
}
