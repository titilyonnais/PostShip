import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/db/service";
import { runHttpCheck } from "@/lib/checks/http";
import { runOgCheck } from "@/lib/checks/og";
import { runSitemapCheck } from "@/lib/checks/sitemap";
import { runSslCheck } from "@/lib/checks/ssl";
import { runStripeHealthCheck } from "@/lib/checks/stripe-health";
import { computeFingerprint, type CheckResult } from "@/lib/checks/shared";
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
  ownerPlan: Plan,
): Promise<SingleTargetResult> {
  const startedAt = new Date().toISOString();

  let result: CheckResult;
  switch (target.kind) {
    case "http":
      result = await runHttpCheck({
        url: target.url,
        expect_status: target.expect_status,
        expect_contains: target.expect_contains,
        expect_not_contains: target.expect_not_contains,
      });
      break;
    case "og":
      result = await runOgCheck({ url: target.url });
      break;
    case "sitemap":
      result = await runSitemapCheck({ url: target.url });
      break;
    case "ssl":
      result = await runSslCheck({ url: target.url });
      break;
    case "stripe_health": {
      if (!getPlanLimits(ownerPlan).stripeHealth) {
        const details = { error: "Le plan actuel n'inclut pas Stripe health." };
        result = {
          outcome: "error",
          http_status: null,
          ttfb_ms: null,
          details,
          fingerprint: computeFingerprint("error", null, details),
        };
        break;
      }
      result = await runStripeHealthCheck({ url: target.url });
      break;
    }
    default: {
      const details = {
        error: `Type de check "${target.kind}" inconnu.`,
      };
      result = {
        outcome: "error",
        http_status: null,
        ttfb_ms: null,
        details,
        fingerprint: computeFingerprint("error", null, details),
      };
    }
  }

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

export async function runOneTarget(targetId: string) {
  const supabase = createServiceClient();

  const { data: target } = await supabase
    .from("check_targets")
    .select(
      "*, projects(id, name, discord_webhook_url, profiles(plan, email, email_alerts_enabled))",
    )
    .eq("id", targetId)
    .single();

  if (!target) {
    throw new Error("URL introuvable.");
  }

  const project = target.projects as unknown as {
    id: string;
    name: string;
    discord_webhook_url: string | null;
    profiles: {
      plan: Plan;
      email: string | null;
      email_alerts_enabled: boolean;
    } | null;
  };
  const owner = project.profiles;
  const ownerPlan = owner?.plan ?? "free";

  const { data: previousRun } = await supabase
    .from("check_runs")
    .select("outcome")
    .eq("target_id", targetId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const result = await runSingleTarget(
    supabase,
    project.id,
    target as CheckTargetRow,
    ownerPlan,
  );

  const previous = previousRun?.outcome ?? null;
  const alertItems: AlertItem[] = [];

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
  } else {
    const shouldAlert = await shouldSendFailAlert(
      supabase,
      project.id,
      targetId,
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
        ownerEmail:
          owner?.email_alerts_enabled === false ? null : (owner?.email ?? null),
        ownerPlanAllowsDiscord: getPlanLimits(ownerPlan).discord,
      },
      alertItems,
    );
  }

  // Recompute the project's overall badge from the latest outcome per
  // target, not just this one — a single-target rerun shouldn't report
  // "pass" at the project level while another target is still failing.
  const { data: allLatest } = await supabase
    .from("check_runs")
    .select("target_id, outcome")
    .eq("project_id", project.id)
    .order("started_at", { ascending: false })
    .limit(500);

  const seen = new Set<string>();
  let overallStatus: "pass" | "fail" = "pass";
  for (const run of allLatest ?? []) {
    if (seen.has(run.target_id)) continue;
    seen.add(run.target_id);
    if (run.outcome === "fail" || run.outcome === "error") {
      overallStatus = "fail";
      break;
    }
  }

  await supabase
    .from("projects")
    .update({
      last_checked_at: new Date().toISOString(),
      last_status: overallStatus,
    })
    .eq("id", project.id);

  return result;
}

export async function runProjectChecks(projectId: string) {
  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, discord_webhook_url, profiles(plan, email, email_alerts_enabled)",
    )
    .eq("id", projectId)
    .single();

  if (!project) {
    throw new Error("Projet introuvable.");
  }

  const owner = project.profiles as unknown as {
    plan: Plan;
    email: string | null;
    email_alerts_enabled: boolean;
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

  const ownerPlan = owner?.plan ?? "free";

  const results = await runWithConcurrencyLimit(
    (targets ?? []) as CheckTargetRow[],
    MAX_CONCURRENCY_PER_PROJECT,
    (target) => runSingleTarget(supabase, projectId, target, ownerPlan),
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
        ownerEmail:
          owner?.email_alerts_enabled === false ? null : (owner?.email ?? null),
        ownerPlanAllowsDiscord: getPlanLimits(ownerPlan).discord,
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
