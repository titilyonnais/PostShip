import Link from "next/link";
import { notFound } from "next/navigation";
import { Activity, CircleDollarSign, Server, TriangleAlert, Users } from "lucide-react";
import { MetricChart } from "@/components/admin/metric-chart";
import { getAuthUser } from "@/lib/db/loaders";
import { getAdminOverview, getStripeSnapshot, isAdminUser } from "@/lib/admin";
import { getInfraPanels } from "@/lib/admin-infra";
import { formatAmount } from "@/lib/billing-history";
import { formatRelativeTime } from "@/lib/format-relative-time";

export const metadata = {
  title: "Supervision",
  robots: { index: false, follow: false },
};

const RANGES = [7, 30, 90] as const;

// Freshness matters more than cache hits on an operations page.
export const dynamic = "force-dynamic";

function Stat({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "good" | "warn" | "bad";
}) {
  const toneClass =
    tone === "good"
      ? "text-[#3fb950]"
      : tone === "warn"
        ? "text-[#d29922]"
        : tone === "bad"
          ? "text-destructive"
          : "text-foreground";

  return (
    <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`font-mono text-2xl font-semibold ${toneClass}`}>{value}</p>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

function SectionTitle({ icon: Icon, children }: { icon: typeof Users; children: React.ReactNode }) {
  return (
    <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
      <Icon className="size-3.5 text-brand-2" aria-hidden="true" />
      {children}
    </h2>
  );
}

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  const user = await getAuthUser();
  // notFound rather than a 403: an unlisted page shouldn't confirm it
  // exists to someone who isn't allowed on it.
  if (!isAdminUser(user?.id)) notFound();

  const { range: rawRange } = await searchParams;
  const days = RANGES.includes(Number(rawRange) as (typeof RANGES)[number])
    ? Number(rawRange)
    : 30;

  const [overview, stripe, infra] = await Promise.all([
    getAdminOverview(days),
    getStripeSnapshot(),
    getInfraPanels(),
  ]);

  if (!overview) {
    return (
      <div className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-muted-foreground">
        Les métriques ne sont pas accessibles pour le moment.
      </div>
    );
  }

  const labels = overview.series.map((p) => p.day.slice(5));
  const checksFailRate =
    overview.checks_24h.total > 0
      ? (overview.checks_24h.failed / overview.checks_24h.total) * 100
      : 0;

  // The runner writes a row every cycle, so a silent hour means the
  // scheduler is stuck, not that the night was quiet.
  const lastRunAgeMin = overview.last_check_run_at
    ? (Date.now() - new Date(overview.last_check_run_at).getTime()) / 60000
    : null;
  const cronTone = lastRunAgeMin === null ? "bad" : lastRunAgeMin > 45 ? "bad" : lastRunAgeMin > 20 ? "warn" : "good";

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Supervision</h1>
          <p className="text-sm text-muted-foreground">
            Données à {new Date(overview.generated_at).toLocaleTimeString("fr-FR")}.
          </p>
        </div>
        <div className="flex gap-1">
          {RANGES.map((r) => (
            <Link
              key={r}
              href={`/app/admin?range=${r}`}
              className={`rounded-sm px-2 py-1 text-xs transition-colors ${
                r === days
                  ? "bg-secondary font-medium text-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              {r} j
            </Link>
          ))}
        </div>
      </div>

      <section className="flex flex-col gap-3">
        <SectionTitle icon={Users}>Audience</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat
            label="En ligne maintenant"
            value={String(overview.presence.online_now)}
            hint="Session rafraîchie dans les 15 dernières minutes"
            tone={overview.presence.online_now > 0 ? "good" : "default"}
          />
          <Stat label="Actifs 24 h" value={String(overview.presence.active_24h)} />
          <Stat label="Actifs 30 j" value={String(overview.presence.active_30d)} />
          <Stat
            label="Inscrits"
            value={String(overview.totals.users)}
            hint={Object.entries(overview.plans)
              .map(([plan, n]) => `${n} ${plan}`)
              .join(" · ")}
          />
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
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
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle icon={Activity}>Activité de surveillance</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Projets" value={String(overview.totals.projects)} />
          <Stat
            label="URLs surveillées"
            value={String(overview.totals.targets_enabled)}
            hint={`${overview.totals.targets} au total`}
          />
          <Stat
            label="Vérifications 24 h"
            value={overview.checks_24h.total.toLocaleString("fr-FR")}
            hint={`${checksFailRate.toFixed(1)}% en échec`}
            tone={checksFailRate > 20 ? "bad" : checksFailRate > 5 ? "warn" : "good"}
          />
          <Stat
            label="Incidents ouverts"
            value={String(overview.totals.incidents_open)}
            tone={overview.totals.incidents_open > 0 ? "bad" : "good"}
          />
        </div>
        <div className="rounded-2xl border border-border bg-card p-4">
          <MetricChart
            labels={labels}
            series={[
              {
                key: "runs",
                label: "Vérifications",
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
        </div>

        {overview.noisiest_projects.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <p className="text-xs text-muted-foreground">
              Projets les plus bruyants sur {days} jours
            </p>
            {overview.noisiest_projects.map((p) => (
              <div
                key={p.id}
                className="flex items-center justify-between gap-3 rounded-xl bg-secondary px-3 py-2 text-sm"
              >
                <span className="min-w-0 truncate">{p.name}</span>
                <span className="font-mono text-xs text-destructive">{p.failed} échecs</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle icon={Server}>Santé de la plateforme</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Stat
            label="Dernière vérification"
            value={
              overview.last_check_run_at
                ? formatRelativeTime(overview.last_check_run_at)
                : "jamais"
            }
            hint="Le runner écrit à chaque cycle : un silence long = cron bloqué"
            tone={cronTone}
          />
          <Stat
            label="Dernier déploiement reçu"
            value={
              overview.last_deploy_event_at
                ? formatRelativeTime(overview.last_deploy_event_at)
                : "jamais"
            }
          />
          <Stat
            label="Fenêtre analysée"
            value={`${overview.window_days} j`}
            hint={`${overview.series.length} points`}
          />
        </div>

        <div className="grid gap-3 lg:grid-cols-3">
          {infra.map((panel) => (
            <div
              key={panel.provider}
              className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-medium">{panel.label}</h3>
                <a
                  href={panel.consoleUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
                >
                  Console
                </a>
              </div>

              {!panel.configured ? (
                <p className="text-xs text-muted-foreground">
                  Pas de jeton configuré. Ajoutez{" "}
                  <code className="rounded-sm bg-secondary px-1 py-0.5 font-mono">
                    {panel.provider === "vercel"
                      ? "VERCEL_API_TOKEN"
                      : panel.provider === "supabase"
                        ? "SUPABASE_MANAGEMENT_TOKEN + SUPABASE_PROJECT_REF"
                        : "RESEND_API_KEY"}
                  </code>{" "}
                  pour voir les métriques ici.
                </p>
              ) : panel.error ? (
                <p className="flex items-start gap-1.5 text-xs text-destructive">
                  <TriangleAlert className="mt-0.5 size-3 shrink-0" aria-hidden="true" />
                  {panel.error}
                </p>
              ) : (
                <dl className="flex flex-col gap-1">
                  {panel.metrics.map((m) => (
                    <div key={m.label} className="flex items-baseline justify-between gap-3">
                      <dt className="text-xs text-muted-foreground">{m.label}</dt>
                      <dd className="font-mono text-sm" title={m.hint}>
                        {m.value}
                      </dd>
                    </div>
                  ))}
                </dl>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <SectionTitle icon={CircleDollarSign}>Revenu</SectionTitle>
        {stripe === null ? (
          <p className="rounded-2xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">
            Stripe n&apos;a pas répondu.
          </p>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <Stat
                label="MRR"
                value={formatAmount(stripe.mrr, stripe.currency)}
                hint="Abonnements actifs, ramenés au mois"
              />
              <Stat label="Abonnements actifs" value={String(stripe.activeSubscriptions)} />
              <Stat
                label="Impayés"
                value={String(stripe.pastDueSubscriptions)}
                tone={stripe.pastDueSubscriptions > 0 ? "bad" : "good"}
              />
              <Stat
                label="Packs de tokens 30 j"
                value={formatAmount(stripe.oneOffRevenue30d, stripe.currency)}
                hint="Paiements uniques, hors abonnement"
              />
            </div>

            {stripe.revenueByMonth.length > 1 && (
              <div className="rounded-2xl border border-border bg-card p-4">
                <MetricChart
                  labels={stripe.revenueByMonth.map((m) => m.month.slice(2))}
                  series={[
                    {
                      key: "revenue",
                      label: "Encaissé",
                      color: "#3fb950",
                      values: stripe.revenueByMonth.map((m) => m.amount),
                    },
                  ]}
                  format="currency"
                  currency={stripe.currency}
                />
              </div>
            )}

            {stripe.failedInvoices.length > 0 && (
              <div className="flex flex-col gap-1.5">
                <p className="text-xs text-destructive">Paiements en échec</p>
                {stripe.failedInvoices.map((invoice) => (
                  <div
                    key={invoice.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-destructive/10 px-3 py-2 text-sm"
                  >
                    <span className="min-w-0 truncate font-mono text-xs">
                      {invoice.customer ?? invoice.id}
                    </span>
                    <span className="font-mono text-xs">
                      {formatAmount(invoice.amount, stripe.currency)} ·{" "}
                      {new Date(invoice.created * 1000).toLocaleDateString("fr-FR")}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
