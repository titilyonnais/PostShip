import type { SupabaseClient } from "@supabase/supabase-js";
import type { FetchBudget } from "@/lib/budgets";
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
  last_outcome?: "pass" | "fail" | "error" | null;
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
  budget?: FetchBudget,
  stripeSuccessUrl?: string | null,
): Promise<SingleTargetResult> {
  const startedAt = new Date().toISOString();

  let result: CheckResult;
  switch (target.kind) {
    case "http":
      result = await runHttpCheck(
        {
          url: target.url,
          expect_status: target.expect_status,
          expect_contains: target.expect_contains,
          expect_not_contains: target.expect_not_contains,
        },
        budget,
      );
      break;
    case "og":
      result = await runOgCheck({ url: target.url }, budget);
      break;
    case "sitemap":
      result = await runSitemapCheck({ url: target.url }, budget);
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
      result = await runStripeHealthCheck(
        { url: stripeSuccessUrl ?? target.url },
        budget,
      );
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

  // Cached on the target row (migration 0031) so callers can read "last
  // outcome" without scanning check_runs — see runOneTarget/runProjectChecks.
  await supabase
    .from("check_targets")
    .update({
      last_outcome: result.outcome,
      last_fingerprint: result.fingerprint,
      last_started_at: startedAt,
    })
    .eq("id", target.id);

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
      "*, projects(id, name, discord_webhook_url, slack_webhook_url, stripe_success_url, profiles(plan, email, email_alerts_enabled))",
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
    slack_webhook_url: string | null;
    stripe_success_url: string | null;
    profiles: {
      plan: Plan;
      email: string | null;
      email_alerts_enabled: boolean;
    } | null;
  };
  const owner = project.profiles;
  const ownerPlan = owner?.plan ?? "free";

  // Captured before runSingleTarget overwrites check_targets.last_outcome
  // with this run's own result (migration 0031).
  const previous = (target as CheckTargetRow).last_outcome ?? null;

  const result = await runSingleTarget(
    supabase,
    project.id,
    target as CheckTargetRow,
    ownerPlan,
    undefined,
    project.stripe_success_url,
  );
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
        slack_webhook_url: project.slack_webhook_url,
        ownerEmail:
          owner?.email_alerts_enabled === false ? null : (owner?.email ?? null),
        ownerPlanAllowsChatWebhooks: getPlanLimits(ownerPlan).chatWebhooks,
      },
      alertItems,
    );
  }

  // Recompute the project's overall badge from each target's cached last
  // outcome (migration 0031), not just this one — a single-target rerun
  // shouldn't report "pass" at the project level while another target is
  // still failing. Reads check_targets directly instead of scanning
  // check_runs for the whole project.
  const { data: allLatest } = await supabase
    .from("check_targets")
    .select("last_outcome")
    .eq("project_id", project.id)
    .eq("enabled", true);

  const overallStatus: "pass" | "fail" = (allLatest ?? []).some(
    (t) => t.last_outcome === "fail" || t.last_outcome === "error",
  )
    ? "fail"
    : "pass";

  await supabase
    .from("projects")
    .update({
      last_checked_at: new Date().toISOString(),
      last_status: overallStatus,
    })
    .eq("id", project.id);

  return result;
}

// Triggered by the Vercel deploy webhook for a `deployment.ready` event
// whose `payload.target !== "production"`, when the project has opted in
// via `check_previews` (settings). Runs the project's enabled targets
// against the preview deployment's own host — same path, different
// hostname — without touching check_runs/check_targets or the project's
// last_status/last_checked_at: a preview is a one-off, not part of the
// monitoring history a user reviews later. Failures alert once, prefixed
// "Preview", bypassing the normal fail/recovery dedup (see dispatchAlerts).
export async function runPreviewChecks(
  projectId: string,
  previewHost: string,
): Promise<{ ranTargets: number; failedTargets: number }> {
  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, discord_webhook_url, slack_webhook_url, profiles(plan, email, email_alerts_enabled)",
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
  const ownerPlan = owner?.plan ?? "free";

  const { data: targets } = await supabase
    .from("check_targets")
    .select("*")
    .eq("project_id", projectId)
    .eq("enabled", true);

  const alertItems: AlertItem[] = [];
  let ranTargets = 0;

  for (const target of (targets ?? []) as CheckTargetRow[]) {
    if (target.kind === "stripe_health") {
      // A preview deployment's success_url isn't reachable via a real
      // Stripe checkout — meaningless to check here.
      continue;
    }

    let previewUrl: string;
    try {
      const u = new URL(target.url);
      u.protocol = "https:";
      u.hostname = previewHost;
      u.port = "";
      previewUrl = u.toString();
    } catch {
      continue;
    }

    let result: CheckResult;
    switch (target.kind) {
      case "http":
        result = await runHttpCheck({
          url: previewUrl,
          expect_status: target.expect_status,
          expect_contains: target.expect_contains,
          expect_not_contains: target.expect_not_contains,
        });
        break;
      case "og":
        result = await runOgCheck({ url: previewUrl });
        break;
      case "sitemap":
        result = await runSitemapCheck({ url: previewUrl });
        break;
      case "ssl":
        result = await runSslCheck({ url: previewUrl });
        break;
      default:
        continue;
    }

    ranTargets += 1;

    if (result.outcome === "fail" || result.outcome === "error") {
      alertItems.push({
        targetId: target.id,
        url: previewUrl,
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
        name: `Preview — ${project.name}`,
        discord_webhook_url: project.discord_webhook_url,
        slack_webhook_url: project.slack_webhook_url,
        ownerEmail:
          owner?.email_alerts_enabled === false ? null : (owner?.email ?? null),
        ownerPlanAllowsChatWebhooks: getPlanLimits(ownerPlan).chatWebhooks,
      },
      alertItems,
      { recordDedup: false },
    );
  }

  return { ranTargets, failedTargets: alertItems.length };
}

export async function runProjectChecks(projectId: string, budget?: FetchBudget) {
  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, discord_webhook_url, slack_webhook_url, stripe_success_url, profiles(plan, email, email_alerts_enabled)",
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

  // Latest outcome per target before this run, to detect fail -> pass
  // recoveries — read from the already-fetched rows' cached last_outcome
  // (migration 0031), captured before runSingleTarget overwrites it below.
  const previousOutcomeByTarget = new Map<string, string>();
  for (const target of (targets ?? []) as CheckTargetRow[]) {
    if (target.last_outcome) {
      previousOutcomeByTarget.set(target.id, target.last_outcome);
    }
  }

  const ownerPlan = owner?.plan ?? "free";

  const results = await runWithConcurrencyLimit(
    (targets ?? []) as CheckTargetRow[],
    MAX_CONCURRENCY_PER_PROJECT,
    (target) =>
      runSingleTarget(
        supabase,
        projectId,
        target,
        ownerPlan,
        budget,
        project.stripe_success_url,
      ),
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
        slack_webhook_url: project.slack_webhook_url,
        ownerEmail:
          owner?.email_alerts_enabled === false ? null : (owner?.email ?? null),
        ownerPlanAllowsChatWebhooks: getPlanLimits(ownerPlan).chatWebhooks,
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
