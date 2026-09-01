import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusDot } from "@/components/status-dot";
import { createClient } from "@/lib/db/server";

type CheckRunDetails = {
  missing?: string[];
  error?: string;
  bodyExcerpt?: string;
};

export default async function TargetPage({
  params,
}: {
  params: Promise<{ projectId: string; targetId: string }>;
}) {
  const { projectId, targetId } = await params;
  const supabase = await createClient();

  const { data: target } = await supabase
    .from("check_targets")
    .select("*")
    .eq("id", targetId)
    .eq("project_id", projectId)
    .single();

  if (!target) notFound();

  const { data: runs } = await supabase
    .from("check_runs")
    .select("*")
    .eq("target_id", targetId)
    .order("started_at", { ascending: false })
    .limit(50);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1">
        <Link
          href={`/app/${projectId}`}
          className="text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          ← Retour au projet
        </Link>
        <h1 className="font-mono text-lg">{target.url}</h1>
      </div>

      <ul className="flex flex-col gap-2">
        {(runs ?? []).map((run) => {
          const details = (run.details ?? {}) as CheckRunDetails;
          return (
            <li key={run.id} className="rounded-md border border-border p-3">
              <div className="flex items-center justify-between">
                <StatusDot status={run.outcome} />
                <span className="text-xs text-muted-foreground">
                  {new Date(run.started_at).toLocaleString("fr-FR")}
                </span>
              </div>
              <div className="mt-2 flex gap-4 text-xs text-muted-foreground">
                <span>Statut HTTP : {run.http_status ?? "—"}</span>
                <span>
                  TTFB : {run.ttfb_ms != null ? `${run.ttfb_ms} ms` : "—"}
                </span>
              </div>
              {run.outcome !== "pass" && (
                <div className="mt-2 flex flex-col gap-1 text-xs">
                  {Array.isArray(details.missing) &&
                    details.missing.length > 0 && (
                      <p className="text-amber-500">
                        Manquant : {details.missing.join(", ")}
                      </p>
                    )}
                  {details.error && (
                    <p className="text-destructive">{details.error}</p>
                  )}
                  {details.bodyExcerpt && (
                    <pre className="overflow-x-auto whitespace-pre-wrap rounded-md border border-border bg-secondary p-2 text-muted-foreground">
                      {details.bodyExcerpt}
                    </pre>
                  )}
                </div>
              )}
            </li>
          );
        })}
        {(!runs || runs.length === 0) && (
          <p className="text-sm text-muted-foreground">
            Aucune exécution pour le moment.
          </p>
        )}
      </ul>
    </div>
  );
}
