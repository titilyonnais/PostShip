import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, History } from "lucide-react";
import { StatusDot } from "@/components/status-dot";
import { FailureDetails, type CheckRunDetails } from "@/components/failure-details";
import { createClient } from "@/lib/db/server";

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
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <div className="flex flex-col gap-1">
        <Link
          href={`/app/${projectId}`}
          className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="size-3" aria-hidden="true" />
          Retour au projet
        </Link>
        <h1 className="font-mono text-lg">{target.url}</h1>
      </div>

      {runs && runs.length > 0 ? (
        <ul className="flex flex-col gap-2">
          {runs.map((run, index) => {
            const details = (run.details ?? {}) as CheckRunDetails;
            return (
              <li
                key={run.id}
                className="rounded-md border border-border bg-card p-3 motion-safe:animate-in motion-safe:fade-in"
                style={{ animationDelay: `${Math.min(index, 10) * 25}ms` }}
              >
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
                  <div className="mt-2">
                    <FailureDetails
                      details={details}
                      httpStatus={run.http_status}
                      expectStatus={target.expect_status}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-md border border-dashed border-border px-4 py-12 text-center">
          <History className="size-6 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Aucune exécution pour le moment.
          </p>
        </div>
      )}
    </div>
  );
}
