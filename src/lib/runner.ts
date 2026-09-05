import type { SupabaseClient } from "@supabase/supabase-js";
import type { FetchBudget } from "@/lib/budgets";
import { createServiceClient } from "@/lib/db/service";
import { runHttpCheck, type MoneyPathAssertions } from "@/lib/checks/http";
import { runOgCheck } from "@/lib/checks/og";
import { runSitemapCheck } from "@/lib/checks/sitemap";
import { runSslCheck } from "@/lib/checks/ssl";
import { runStripeHealthCheck } from "@/lib/checks/stripe-health";
import { computeFingerprint, type CheckResult } from "@/lib/checks/shared";
import { runWithConcurrencyLimit } from "@/lib/concurrency";
import { dispatchAlerts, shouldSendFailAlert, type AlertItem } from "@/lib/alerts";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import {
  nextConsecutiveFails,
  shouldAlertFail,
  shouldAlertRecovered,
} from "@/lib/alert-confirm";
import type { SnapshotItem } from "@/lib/deploy-diff";
import { describeSurfaceMutation, detectSurfaceMutations, shouldAlertMutated, type PageSurface } from "@/lib/surface";

const MAX_CONCURRENCY_PER_PROJECT = 3;

type CheckTargetRow = {
  id: string;
  kind: string;
  url: string;
  expect_status: number;
  expect_contains: string | null;
  expect_not_contains: string | null;
  assertions?: MoneyPathAssertions | null;
  request_header_name?: string | null;
  request_header_value?: string | null;
  last_outcome?: "pass" | "fail" | "error" | null;
  consecutive_fails?: number | null;
  silenced_until?: string | null;
};

type SingleTargetResult = {
  targetId: string;
  url: string;
  outcome: "pass" | "fail" | "error";
  http_status: number | null;
  ttfb_ms: number | null;
  fingerprint: string;
  missing: string[] | null;
  consecutiveFails: number;
  silencedUntil: string | null;
  mutated: boolean;
  mutationSummary: string | null;
  // V7 (ia-moderne backlog): everything computeShipScore (src/lib/
  // ship-score.ts) needs to categorize this target, carried on the
  // result so the deploy webhook routes don't have to re-fetch targets.
  kind: string;
  isMoneyPath: boolean;
  sslDaysRemaining: number | null;
};

// V6 (ia-moderne backlog): compares this run's scraped page surface
// against the last one stored for this target, upserts the new one, and
// reports whether it counts as a "mutated" alert — deploy runs only (see
// src/lib/surface.ts). A failure here must never break the check itself.
async function trackPageSurface(
  supabase: SupabaseClient,
  projectId: string,
  targetId: string,
  surface: PageSurface,
  isDeployRun: boolean,
): Promise<{ mutated: boolean; mutationSummary: string | null }> {
  try {
    const { data: existing } = await supabase
      .from("page_surfaces")
      .select("title, h1, description, og_title, mutated_at")
      .eq("target_id", targetId)
      .maybeSingle();

    const before: PageSurface | null = existing
      ? {
          title: existing.title,
          h1: existing.h1,
          description: existing.description,
          ogTitle: existing.og_title,
        }
      : null;

    const mutated = shouldAlertMutated(before, surface, isDeployRun);
    const mutationSummary = mutated
      ? detectSurfaceMutations(before, surface).map(describeSurfaceMutation).join(" · ")
      : null;

    await supabase.from("page_surfaces").upsert(
      {
        project_id: projectId,
        target_id: targetId,
        title: surface.title,
        h1: surface.h1,
        description: surface.description,
        og_title: surface.ogTitle,
        seen_at: new Date().toISOString(),
        mutated_at: mutated ? new Date().toISOString() : (existing?.mutated_at ?? null),
      },
      { onConflict: "target_id" },
    );

    return { mutated, mutationSummary };
  } catch (err) {
    console.error("Échec suivi de la surface de page", err);
    return { mutated: false, mutationSummary: null };
  }
}

async function runSingleTarget(
  supabase: SupabaseClient,
  projectId: string,
  target: CheckTargetRow,
  ownerPlan: Plan,
  budget?: FetchBudget,
  stripeSuccessUrl?: string | null,
  // Set by runProjectChecks when this run was triggered by a production
  // deploy webhook — gates the V6 "mutated" alert (never runOneTarget or
  // the cron/manual path).
  deployHint?: string,
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
          assertions: target.assertions,
          requestHeader:
            target.request_header_name && target.request_header_value
              ? { name: target.request_header_name, value: target.request_header_value }
              : null,
        },
        budget,
        true,
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

  // D6 (drill-nav backlog): consecutive_fails gates whether dispatchAlerts
  // fires (see runOneTarget/runProjectChecks) — computed from the streak
  // length as it stood before this run, captured by the caller.
  const consecutiveFails = nextConsecutiveFails(
    result.outcome,
    target.consecutive_fails ?? 0,
  );

  // Cached on the target row (migration 0031) so callers can read "last
  // outcome" without scanning check_runs — see runOneTarget/runProjectChecks.
  await supabase
    .from("check_targets")
    .update({
      last_outcome: result.outcome,
      last_fingerprint: result.fingerprint,
      last_started_at: startedAt,
      consecutive_fails: consecutiveFails,
    })
    .eq("id", target.id);

  const missing = Array.isArray(result.details?.missing)
    ? (result.details.missing as string[])
    : null;

  // V6 (ia-moderne backlog): only http targets scrape a page surface
  // (see http.ts's extractHtmlMeta) — details.surface is null for every
  // other check kind, or a non-HTML http response.
  const surface = (result.details as { surface?: PageSurface | null } | undefined)
    ?.surface;
  const { mutated, mutationSummary } = surface
    ? await trackPageSurface(supabase, projectId, target.id, surface, !!deployHint)
    : { mutated: false, mutationSummary: null };

  const isMoneyPath =
    target.kind === "http" && !!target.assertions && Object.keys(target.assertions).length > 0;
  const sslDaysRemaining =
    target.kind === "ssl"
      ? ((result.details as { daysRemaining?: number } | undefined)?.daysRemaining ?? null)
      : null;

  return {
    targetId: target.id,
    url: target.url,
    outcome: result.outcome,
    http_status: result.http_status,
    ttfb_ms: result.ttfb_ms,
    fingerprint: result.fingerprint,
    missing,
    consecutiveFails,
    silencedUntil: target.silenced_until ?? null,
    mutated,
    mutationSummary,
    kind: target.kind,
    isMoneyPath,
    sslDaysRemaining,
  };
}

export async function runOneTarget(targetId: string) {
  const supabase = createServiceClient();

  const { data: target } = await supabase
    .from("check_targets")
    .select(
      "*, projects(id, name, discord_webhook_url, slack_webhook_url, telegram_bot_token, telegram_chat_id, alerts_silenced_until, stripe_success_url, alert_confirm_count, quiet_hours_start, quiet_hours_end, quiet_hours_tz, outbound_webhook_url, outbound_webhook_secret, profiles(plan, email, email_alerts_enabled, notify_recovered, notify_mutated))",
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
    telegram_bot_token: string | null;
    telegram_chat_id: string | null;
    alerts_silenced_until: string | null;
    stripe_success_url: string | null;
    alert_confirm_count: number;
    quiet_hours_start: number | null;
    quiet_hours_end: number | null;
    quiet_hours_tz: string;
    outbound_webhook_url: string | null;
    outbound_webhook_secret: string | null;
    profiles: {
      plan: Plan;
      email: string | null;
      email_alerts_enabled: boolean;
    notify_recovered: boolean;
    notify_mutated: boolean;
    } | null;
  };
  const owner = project.profiles;
  const ownerPlan = owner?.plan ?? "free";
  const confirmCount = project.alert_confirm_count ?? 1;

  // Captured before runSingleTarget overwrites check_targets.last_outcome /
  // consecutive_fails with this run's own result (migration 0031, 0045).
  const previous = (target as CheckTargetRow).last_outcome ?? null;
  const previousConsecutiveFails = (target as CheckTargetRow).consecutive_fails ?? 0;

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
    if (shouldAlertRecovered(previous, previousConsecutiveFails, confirmCount)) {
      alertItems.push({
        targetId: result.targetId,
        url: result.url,
        kind: "recovered",
        checkKind: result.kind as AlertItem["checkKind"],
        outcome: result.outcome,
        httpStatus: result.http_status,
        fingerprint: result.fingerprint,
        missing: result.missing,
        ttfbMs: result.ttfb_ms,
        silencedUntil: result.silencedUntil,
      });
    }
  } else if (shouldAlertFail(result.consecutiveFails, confirmCount)) {
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
        checkKind: result.kind as AlertItem["checkKind"],
        outcome: result.outcome,
        httpStatus: result.http_status,
        fingerprint: result.fingerprint,
        missing: result.missing,
        ttfbMs: result.ttfb_ms,
        silencedUntil: result.silencedUntil,
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
        telegram_bot_token: project.telegram_bot_token,
        telegram_chat_id: project.telegram_chat_id,
        alerts_silenced_until: project.alerts_silenced_until,
        quiet_hours_start: project.quiet_hours_start,
        quiet_hours_end: project.quiet_hours_end,
        quiet_hours_tz: project.quiet_hours_tz,
        outbound_webhook_url: project.outbound_webhook_url,
        outbound_webhook_secret: project.outbound_webhook_secret,
        ownerEmail:
          owner?.email_alerts_enabled === false ? null : (owner?.email ?? null),
        ownerNotifyRecovered: owner?.notify_recovered !== false,
        ownerNotifyMutated: owner?.notify_mutated !== false,
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
): Promise<{
  ranTargets: number;
  failedTargets: number;
  snapshot: SnapshotItem[];
}> {
  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, discord_webhook_url, slack_webhook_url, telegram_bot_token, telegram_chat_id, alerts_silenced_until, quiet_hours_start, quiet_hours_end, quiet_hours_tz, outbound_webhook_url, outbound_webhook_secret, profiles(plan, email, email_alerts_enabled, notify_recovered, notify_mutated)",
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
    notify_recovered: boolean;
    notify_mutated: boolean;
  } | null;
  const ownerPlan = owner?.plan ?? "free";

  const { data: targets } = await supabase
    .from("check_targets")
    .select("*")
    .eq("project_id", projectId)
    .eq("enabled", true);

  const alertItems: AlertItem[] = [];
  const snapshot: SnapshotItem[] = [];
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
        result = await runHttpCheck(
          {
            url: previewUrl,
            expect_status: target.expect_status,
            expect_contains: target.expect_contains,
            expect_not_contains: target.expect_not_contains,
            assertions: target.assertions,
          },
          undefined,
          true,
        );
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
    snapshot.push({ targetId: target.id, url: previewUrl, outcome: result.outcome });

    if (result.outcome === "fail" || result.outcome === "error") {
      alertItems.push({
        targetId: target.id,
        url: previewUrl,
        kind: "fail",
        checkKind: target.kind as AlertItem["checkKind"],
        outcome: result.outcome,
        httpStatus: result.http_status,
        fingerprint: result.fingerprint,
        missing: Array.isArray(result.details?.missing)
          ? (result.details.missing as string[])
          : null,
        ttfbMs: result.ttfb_ms,
        silencedUntil: target.silenced_until ?? null,
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
        telegram_bot_token: project.telegram_bot_token,
        telegram_chat_id: project.telegram_chat_id,
        alerts_silenced_until: project.alerts_silenced_until,
        quiet_hours_start: project.quiet_hours_start,
        quiet_hours_end: project.quiet_hours_end,
        quiet_hours_tz: project.quiet_hours_tz,
        outbound_webhook_url: project.outbound_webhook_url,
        outbound_webhook_secret: project.outbound_webhook_secret,
        ownerEmail:
          owner?.email_alerts_enabled === false ? null : (owner?.email ?? null),
        ownerNotifyRecovered: owner?.notify_recovered !== false,
        ownerNotifyMutated: owner?.notify_mutated !== false,
        ownerPlanAllowsChatWebhooks: getPlanLimits(ownerPlan).chatWebhooks,
      },
      alertItems,
      { recordDedup: false },
    );
  }

  return { ranTargets, failedTargets: alertItems.length, snapshot };
}

export async function runProjectChecks(
  projectId: string,
  budget?: FetchBudget,
  // Set by the deploy webhook routes (vercel/netlify/cloudflare) so the
  // alert copy can prefix "Depuis le dernier déploiement : " — cron ticks
  // and manual "Lancer maintenant" runs leave it unset.
  deployHint?: string,
) {
  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, discord_webhook_url, slack_webhook_url, telegram_bot_token, telegram_chat_id, alerts_silenced_until, stripe_success_url, alert_confirm_count, quiet_hours_start, quiet_hours_end, quiet_hours_tz, outbound_webhook_url, outbound_webhook_secret, profiles(plan, email, email_alerts_enabled, notify_recovered, notify_mutated)",
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
    notify_recovered: boolean;
    notify_mutated: boolean;
  } | null;
  const confirmCount = project.alert_confirm_count ?? 1;

  const { data: targets, error } = await supabase
    .from("check_targets")
    .select("*")
    .eq("project_id", projectId)
    .eq("enabled", true);

  if (error) {
    throw new Error(`Impossible de charger les targets: ${error.message}`);
  }

  // Latest outcome / fail-streak length per target before this run, to
  // detect fail -> pass recoveries and gate confirm-after-N-fails — read
  // from the already-fetched rows' cached columns (migrations 0031, 0045),
  // captured before runSingleTarget overwrites them below.
  const previousOutcomeByTarget = new Map<string, "pass" | "fail" | "error">();
  const previousConsecutiveFailsByTarget = new Map<string, number>();
  for (const target of (targets ?? []) as CheckTargetRow[]) {
    if (target.last_outcome) {
      previousOutcomeByTarget.set(target.id, target.last_outcome);
    }
    previousConsecutiveFailsByTarget.set(target.id, target.consecutive_fails ?? 0);
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
        deployHint,
      ),
  );

  const alertItems: AlertItem[] = [];
  for (const result of results) {
    const previous = previousOutcomeByTarget.get(result.targetId) ?? null;
    const previousConsecutiveFails =
      previousConsecutiveFailsByTarget.get(result.targetId) ?? 0;

    // V6 (ia-moderne backlog): independent of pass/fail — a page can
    // return 200 and still have quietly lost its H1/title/description/
    // og:title after this deploy. trackPageSurface already gated
    // `mutated` on deployHint being set (see runSingleTarget).
    if (result.mutated) {
      alertItems.push({
        targetId: result.targetId,
        url: result.url,
        kind: "mutated",
        checkKind: result.kind as AlertItem["checkKind"],
        outcome: result.outcome,
        httpStatus: result.http_status,
        fingerprint: result.fingerprint,
        deployHint,
        silencedUntil: result.silencedUntil,
        mutationSummary: result.mutationSummary,
      });
    }

    if (result.outcome === "pass") {
      if (shouldAlertRecovered(previous, previousConsecutiveFails, confirmCount)) {
        alertItems.push({
          targetId: result.targetId,
          url: result.url,
          kind: "recovered",
          checkKind: result.kind as AlertItem["checkKind"],
          outcome: result.outcome,
          httpStatus: result.http_status,
          fingerprint: result.fingerprint,
          missing: result.missing,
          ttfbMs: result.ttfb_ms,
          deployHint,
          silencedUntil: result.silencedUntil,
        });
      }
      continue;
    }

    if (!shouldAlertFail(result.consecutiveFails, confirmCount)) continue;

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
        checkKind: result.kind as AlertItem["checkKind"],
        outcome: result.outcome,
        httpStatus: result.http_status,
        fingerprint: result.fingerprint,
        missing: result.missing,
        ttfbMs: result.ttfb_ms,
        deployHint,
        silencedUntil: result.silencedUntil,
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
        telegram_bot_token: project.telegram_bot_token,
        telegram_chat_id: project.telegram_chat_id,
        alerts_silenced_until: project.alerts_silenced_until,
        quiet_hours_start: project.quiet_hours_start,
        quiet_hours_end: project.quiet_hours_end,
        quiet_hours_tz: project.quiet_hours_tz,
        outbound_webhook_url: project.outbound_webhook_url,
        outbound_webhook_secret: project.outbound_webhook_secret,
        ownerEmail:
          owner?.email_alerts_enabled === false ? null : (owner?.email ?? null),
        ownerNotifyRecovered: owner?.notify_recovered !== false,
        ownerNotifyMutated: owner?.notify_mutated !== false,
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
