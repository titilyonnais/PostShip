import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/db/service";
import { runHttpCheck } from "@/lib/checks/http";
import { runWithConcurrencyLimit } from "@/lib/concurrency";
import { dispatchAlerts, shouldSendFailAlert, type AlertItem } from "@/lib/alerts";
import { getPlanLimits, type Plan } from "@/lib/entitlements";

const MAX_CONCURRENCY_PER_PROJECT = 3;

type CheckTargetRow = {
  id: string;
  kind: string;
  url: string;
  expect_status: number;
  expect_contains: string | null;
  expect_not_contains: string | null;
};

type SingleTargetResult = {
  targetId: string;
  url: string;
  outcome: "pass" | "fail" | "error";
  http_status: number | null;
  ttfb_ms: number | null;
  fingerprint: string;
};

async function runSingleTarget(
  supabase: SupabaseClient,
  projectId: string,
  target: CheckTargetRow,
): Promise<SingleTargetResult> {
  const startedAt = new Date().toISOString();

  const result =
    target.kind === "http"
      ? await runHttpCheck({
          url: target.url,
          expect_status: target.expect_status,
          expect_contains: target.expect_contains,
          expect_not_contains: target.expect_not_contains,
        })
      : {
          outcome: "error" as const,
          http_status: null,
          ttfb_ms: null,
          details: {
            error: `Type de check "${target.kind}" pas encore implémenté.`,
          },
          fingerprint: `error|unimplemented:${target.kind}`,
        };

  await supabase.from("check_runs").insert({
    target_id: target.id,
    project_id: projectId,
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    outcome: result.outcome,
    http_status: result.http_status,
    ttfb_ms: result.ttfb_ms,
    fingerprint: result.fingerprint,
    details: result.details,
  });

  return {
    targetId: target.id,
    url: target.url,
    outcome: result.outcome,
    http_status: result.http_status,
    ttfb_ms: result.ttfb_ms,
    fingerprint: result.fingerprint,
  };
}

export async function runProjectChecks(projectId: string) {
  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, discord_webhook_url, profiles(plan, email)")
    .eq("id", projectId)
    .single();

  if (!project) {
    throw new Error("Projet introuvable.");
  }

  const owner = project.profiles as unknown as {
    plan: Plan;
    email: string | null;
  } | null;

  const { data: targets, error } = await supabase
    .from("check_targets")
    .select("*")
    .eq("project_id", projectId)
    .eq("enabled", true);

  if (error) {
    throw new Error(`Impossible de charger les targets: ${error.message}`);
  }

  // Latest outcome per target before this run, to detect fail -> pass recoveries.
  const { data: previousRuns } = await supabase
    .from("check_runs")
    .select("target_id, outcome")
    .eq("project_id", projectId)
    .order("started_at", { ascending: false })
    .limit(500);

  const previousOutcomeByTarget = new Map<string, string>();
  for (const run of previousRuns ?? []) {
    if (!previousOutcomeByTarget.has(run.target_id)) {
      previousOutcomeByTarget.set(run.target_id, run.outcome);
    }
  }

  const results = await runWithConcurrencyLimit(
    (targets ?? []) as CheckTargetRow[],
    MAX_CONCURRENCY_PER_PROJECT,
    (target) => runSingleTarget(supabase, projectId, target),
  );

  const alertItems: AlertItem[] = [];
  for (const result of results) {
    const previous = previousOutcomeByTarget.get(result.targetId) ?? null;

    if (result.outcome === "pass") {
      if (previous && previous !== "pass") {
        alertItems.push({
          targetId: result.targetId,
          url: result.url,
          kind: "recovered",
          outcome: result.outcome,
          httpStatus: result.http_status,
          fingerprint: result.fingerprint,
        });
      }
      continue;
    }

    const shouldAlert = await shouldSendFailAlert(
      supabase,
      projectId,
      result.targetId,
      result.fingerprint,
    );

    if (shouldAlert) {
      alertItems.push({
        targetId: result.targetId,
        url: result.url,
        kind: "fail",
        outcome: result.outcome,
        httpStatus: result.http_status,
        fingerprint: result.fingerprint,
      });
    }
  }

  if (alertItems.length > 0) {
    await dispatchAlerts(
      supabase,
      {
        id: project.id,
        name: project.name,
        discord_webhook_url: project.discord_webhook_url,
        ownerEmail: owner?.email ?? null,
        ownerPlanAllowsDiscord: getPlanLimits(owner?.plan ?? "free").discord,
      },
      alertItems,
    );
  }

  const overallStatus = results.some(
    (r) => r.outcome === "fail" || r.outcome === "error",
  )
    ? "fail"
    : "pass";

  await supabase
    .from("projects")
    .update({
      last_checked_at: new Date().toISOString(),
      last_status: overallStatus,
    })
    .eq("id", projectId);

  return results;
}
