import Link from "next/link";
import { Panel } from "@/components/admin/console-ui";
import { OPS_PAGE_SIZE, queryOpsEvents } from "@/lib/ops-events";
import { LogRows } from "./log-rows";

export const metadata = { title: "Journal" };
export const dynamic = "force-dynamic";

const SOURCES = ["console", "auth", "stripe", "billing", "runner", "scan", "admin_alert"];
const SEVERITIES = ["info", "warn", "error", "fraud"];

const FIELD =
  "border border-neutral-800 bg-[#0d0f12] px-2 py-1 font-mono text-xs text-neutral-100 placeholder:text-neutral-700 focus:border-[#3fb950] focus:outline-none";

function withParam(
  params: Record<string, string | undefined>,
  key: string,
  value: string | undefined,
): string {
  const next = new URLSearchParams();
  for (const [k, v] of Object.entries({ ...params, [key]: value })) {
    // Changing a filter always returns to the first page: staying on
    // page 7 of a result set that no longer has seven pages shows nothing
    // and reads as a bug.
    if (v && k !== "page") next.set(k, v);
  }
  const query = next.toString();
  return query ? `/admin/logs?${query}` : "/admin/logs";
}

export default async function ConsoleLogs({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const params = await searchParams;
  const page = Math.max(0, Number(params.page ?? 0) || 0);

  const { rows, hasMore } = await queryOpsEvents({
    source: SOURCES.includes(params.source ?? "") ? params.source : undefined,
    severity: SEVERITIES.includes(params.severity ?? "") ? params.severity : undefined,
    q: params.q,
    from: params.from,
    to: params.to,
    page,
  });

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono text-sm text-neutral-100">Journal</h1>
        <span className="font-mono text-xs text-neutral-600">
          {rows.length} événement{rows.length > 1 ? "s" : ""}
          {hasMore ? " (page suivante disponible)" : ""}
        </span>
      </div>

      <Panel>
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-1">
            <Link
              href={withParam(params, "source", undefined)}
              className={`px-2 py-1 font-mono text-xs ${
                !params.source
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-200"
              }`}
            >
              toutes sources
            </Link>
            {SOURCES.map((source) => (
              <Link
                key={source}
                href={withParam(params, "source", source)}
                className={`px-2 py-1 font-mono text-xs ${
                  params.source === source
                    ? "bg-neutral-800 text-neutral-100"
                    : "text-neutral-500 hover:text-neutral-200"
                }`}
              >
                {source}
              </Link>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1">
            <Link
              href={withParam(params, "severity", undefined)}
              className={`px-2 py-1 font-mono text-xs ${
                !params.severity
                  ? "bg-neutral-800 text-neutral-100"
                  : "text-neutral-500 hover:text-neutral-200"
              }`}
            >
              toutes gravités
            </Link>
            {SEVERITIES.map((severity) => (
              <Link
                key={severity}
                href={withParam(params, "severity", severity)}
                className={`px-2 py-1 font-mono text-xs ${
                  params.severity === severity
                    ? "bg-neutral-800 text-neutral-100"
                    : "text-neutral-500 hover:text-neutral-200"
                }`}
              >
                {severity}
              </Link>
            ))}
          </div>

          {/* A GET form, so every filtered view is a URL you can paste to
              someone or keep in a bookmark. */}
          <form method="get" className="flex flex-wrap items-center gap-2">
            {params.source && <input type="hidden" name="source" value={params.source} />}
            {params.severity && (
              <input type="hidden" name="severity" value={params.severity} />
            )}
            <input
              name="q"
              defaultValue={params.q ?? ""}
              placeholder="action ou cible (cus_…, un email, un id projet)"
              className={`${FIELD} min-w-[280px] flex-1`}
            />
            <input
              type="date"
              name="from"
              defaultValue={params.from ?? ""}
              className={FIELD}
            />
            <input type="date" name="to" defaultValue={params.to ?? ""} className={FIELD} />
            <button
              type="submit"
              className="border border-neutral-700 px-3 py-1 font-mono text-xs text-neutral-200 hover:border-neutral-500"
            >
              Filtrer
            </button>
            {(params.q || params.from || params.to) && (
              <Link
                href={withParam({ source: params.source, severity: params.severity }, "q", undefined)}
                className="font-mono text-xs text-neutral-600 hover:text-neutral-300"
              >
                effacer
              </Link>
            )}
          </form>
        </div>
      </Panel>

      <Panel>
        <LogRows rows={rows} />
      </Panel>

      <div className="flex items-center justify-between gap-3">
        {page > 0 ? (
          <Link
            href={`/admin/logs?${new URLSearchParams({ ...params, page: String(page - 1) } as Record<string, string>).toString()}`}
            className="border border-neutral-800 px-3 py-1 font-mono text-xs text-neutral-400 hover:border-neutral-700 hover:text-neutral-100"
          >
            ← précédent
          </Link>
        ) : (
          <span />
        )}
        {hasMore && (
          <Link
            href={`/admin/logs?${new URLSearchParams({ ...params, page: String(page + 1) } as Record<string, string>).toString()}`}
            className="border border-neutral-800 px-3 py-1 font-mono text-xs text-neutral-400 hover:border-neutral-700 hover:text-neutral-100"
          >
            suivant →
          </Link>
        )}
      </div>

      <p className="font-mono text-[0.65rem] text-neutral-700">
        {OPS_PAGE_SIZE} par page · conservé 90 jours · console, auth, Stripe,
        facturation, runner, scans
      </p>
    </div>
  );
}
