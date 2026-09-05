import Link from "next/link";
import { MetricChart } from "@/components/admin/metric-chart";
import { Metric, Panel, Row, Cell, Table, Tag } from "@/components/admin/console-ui";
import { getAdminOverview } from "@/lib/admin";
import { formatRelativeTime } from "@/lib/format-relative-time";

export const metadata = { title: "Vue d'ensemble" };
export const dynamic = "force-dynamic";

const RANGES = [7, 30, 90] as const;

export default async function ConsoleOverview({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const { range } = await searchParams;
  const days = RANGES.includes(Number(range) as (typeof RANGES)[number])
    ? Number(range)
    : 30;

  const overview = await getAdminOverview(days);
  if (!overview) {
    return (
      <p className="font-mono text-xs text-[#f85149]">
        Les métriques ne répondent pas.
      </p>
    );
  }

  const labels = overview.series.map((p) => p.day.slice(5));
  const failRate =
    overview.checks_24h.total > 0
      ? (overview.checks_24h.failed / overview.checks_24h.total) * 100
      : 0;

  // The runner writes a row every cycle, so a long silence means the
  // scheduler is stuck rather than the night being quiet.
  const ageMin = overview.last_check_run_at
    ? (Date.now() - new Date(overview.last_check_run_at).getTime()) / 60000
    : null;
  const cronTone = ageMin === null || ageMin > 45 ? "bad" : ageMin > 20 ? "warn" : "good";

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono text-sm text-neutral-100">Vue d&apos;ensemble</h1>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/admin?range=${r}`}
              className={`px-2 py-1 font-mono text-xs ${
                r === days
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-200"
              }`}
            >
              {r}j
            </Link>
          ))}
        </div>
      </div>

      <div className="grid gap-px bg-neutral-900 sm:grid-cols-2 lg:grid-cols-4">
        <Metric
          label="En ligne"
          value={String(overview.presence.online_now)}
          hint="session active < 15 min"
          tone={overview.presence.online_now > 0 ? "good" : "default"}
        />
        <Metric label="Actifs 24 h" value={String(overview.presence.active_24h)} />
        <Metric label="Actifs 30 j" value={String(overview.presence.active_30d)} />
        <Metric
          label="Comptes"
          value={String(overview.totals.users)}
          hint={Object.entries(overview.plans)
            .map(([plan, n]) => `${n} ${plan}`)
            .join(" · ")}
        />
        <Metric label="Projets" value={String(overview.totals.projects)} />
        <Metric
          label="URLs actives"
          value={String(overview.totals.targets_enabled)}
          hint={`${overview.totals.targets} au total`}
        />
        <Metric
          label="Checks 24 h"
          value={overview.checks_24h.total.toLocaleString("fr-FR")}
          hint={`${failRate.toFixed(1)}% en échec`}
          tone={failRate > 20 ? "bad" : failRate > 5 ? "warn" : "good"}
        />
        <Metric
          label="Incidents ouverts"
          value={String(overview.totals.incidents_open)}
          tone={overview.totals.incidents_open > 0 ? "bad" : "good"}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Audience">
          <MetricChart
            labels={labels}
            series={[
              {
                key: "active",
                label: "Actifs",
                color: "#3fb950",
                values: overview.series.map((p) => p.active_users),
              },
              {
                key: "signups",
                label: "Inscriptions",
                color: "#d29922",
                values: overview.series.map((p) => p.signups),
              },
            ]}
          />
        </Panel>

        <Panel title="Vérifications">
          <MetricChart
            labels={labels}
            series={[
              {
                key: "runs",
                label: "Total",
                color: "#58a6ff",
                values: overview.series.map((p) => p.check_runs),
              },
              {
                key: "failed",
                label: "Échecs",
                color: "#f85149",
                values: overview.series.map((p) => p.failed_runs),
              },
            ]}
          />
        </Panel>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Panel title="Ordonnanceur">
          <div className="flex flex-col gap-2 font-mono text-xs">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Dernière vérification</span>
              <Tag tone={cronTone}>
                {overview.last_check_run_at
                  ? formatRelativeTime(overview.last_check_run_at)
                  : "jamais"}
              </Tag>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Dernier déploiement reçu</span>
              <span className="text-neutral-300">
                {overview.last_deploy_event_at
                  ? formatRelativeTime(overview.last_deploy_event_at)
                  : "jamais"}
              </span>
            </div>
          </div>
        </Panel>

        <Panel title={`Projets les plus bruyants — ${days} j`}>
          <Table
            head={["Projet", "Échecs"]}
            empty={overview.noisiest_projects.length === 0}
          >
            {overview.noisiest_projects.map((p) => (
              <Row key={p.id}>
                <Cell>{p.name}</Cell>
                <Cell className="text-[#f85149]">{p.failed}</Cell>
              </Row>
            ))}
          </Table>
        </Panel>
      </div>
    </div>
  );
}
