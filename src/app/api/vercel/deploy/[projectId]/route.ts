import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { describeAlertItem } from "@/lib/alert-copy";
import { createServiceClient } from "@/lib/db/service";
import { recordDeployEvent, scheduleDeployWatches } from "@/lib/deploys";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { postGithubCheckRun } from "@/lib/github-check";
import { runPreviewChecks, runProjectChecks } from "@/lib/runner";
import { computeShipScore } from "@/lib/ship-score";

// Signature scheme confirmed via Vercel docs (context7, vercel.com/docs/headers/request-headers):
// HMAC-SHA1 of the raw body, hex-encoded, in the `x-vercel-signature` header.
function isValidSignature(rawBody: string, secret: string, header: string | null) {
  if (!header) return false;
  const expected = crypto.createHmac("sha1", secret).update(rawBody).digest("hex");
  if (header.length !== expected.length) return false;
  // Belt and suspenders around the length check above: timingSafeEqual
  // throws (rather than returning false) on any input it considers
  // malformed, and a thrown error here must never surface as a 500 — an
  // attacker sending a garbled header shouldn't get anything but the same
  // 401 a wrong signature gets.
  try {
    return crypto.timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const rawBody = await request.text();
  const signature = request.headers.get("x-vercel-signature");

  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, base_url, vercel_hook_secret, check_previews, github_repo, github_token_enc, profiles(plan)",
    )
    .eq("id", projectId)
    .single();

  if (!project?.vercel_hook_secret) {
    return NextResponse.json({ error: "Not configured" }, { status: 404 });
  }

  if (!isValidSignature(rawBody, project.vercel_hook_secret, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const owner = project.profiles as unknown as { plan: Plan } | null;
  if (!getPlanLimits(owner?.plan ?? "free").deployHooks) {
    return NextResponse.json({ error: "Plan does not include this" }, { status: 403 });
  }

  // Fields confirmed against Vercel's own webhook docs
  // (vercel.com/docs/webhooks/webhooks-api) — payload.target is
  // "production" | "staging" | null, payload.deployment.url is the
  // deployment's own hostname (no protocol). meta.githubCommitSha is
  // Vercel's documented git-integration metadata key (F7, features
  // backlog) — absent for non-git deploys, handled as a plain no-op below,
  // never a hard failure if Vercel ever renames/drops it.
  let event: {
    type?: string;
    payload?: {
      target?: string | null;
      deployment?: { url?: string; meta?: Record<string, string> };
    };
  };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  // Only a successfully ready deployment should trigger a check — ignore
  // deployment.created / deployment.error / anything else.
  if (event.type !== "deployment.ready") {
    return NextResponse.json({ skipped: true });
  }

  const isProduction = event.payload?.target === "production";

  if (!isProduction) {
    if (!project.check_previews) {
      return NextResponse.json({ skipped: "preview_checks_disabled" });
    }

    const deploymentUrl = event.payload?.deployment?.url;
    // Every Vercel deployment (preview or production) is reachable at its
    // own *.vercel.app hostname regardless of any custom domain attached —
    // restricting to that suffix keeps this pointed at a real Vercel
    // deployment even though the request is already HMAC-verified above.
    if (!deploymentUrl || !/^[a-z0-9-]+(\.[a-z0-9-]+)*\.vercel\.app$/i.test(deploymentUrl)) {
      return NextResponse.json({ skipped: "invalid_preview_url" });
    }

    try {
      const result = await runPreviewChecks(projectId, deploymentUrl);
      await recordDeployEvent(supabase, {
        projectId,
        provider: "vercel",
        kind: "preview",
        sha: event.payload?.deployment?.meta?.githubCommitSha ?? null,
        deploymentUrl: `https://${deploymentUrl}`,
        outcome:
          result.ranTargets === 0 ? null : result.failedTargets === 0 ? "pass" : "fail",
        failCount: result.failedTargets,
        snapshot: result.snapshot,
      });
      return NextResponse.json({ triggered: true, preview: true, ...result });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Check failed" },
        { status: 500 },
      );
    }
  }

  let results: Awaited<ReturnType<typeof runProjectChecks>>;
  try {
    results = await runProjectChecks(
      projectId,
      undefined,
      `deploy Vercel ${new Date().toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" })}`,
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Check failed" },
      { status: 500 },
    );
  }

  // V7 (ia-moderne backlog): one number for this deploy, posted below to
  // the GitHub Check and read back on Aperçu.
  const shipScore = computeShipScore(results);

  const deployEventId = await recordDeployEvent(supabase, {
    projectId,
    provider: "vercel",
    kind: "production",
    sha: event.payload?.deployment?.meta?.githubCommitSha ?? null,
    deploymentUrl: event.payload?.deployment?.url
      ? `https://${event.payload.deployment.url}`
      : null,
    outcome:
      results.length === 0
        ? null
        : results.every((r) => r.outcome === "pass")
          ? "pass"
          : "fail",
    failCount: results.filter((r) => r.outcome !== "pass").length,
    snapshot: results.map((r) => ({
      targetId: r.targetId,
      url: r.url,
      outcome: r.outcome,
    })),
    score: shipScore.score,
    scoreReason: shipScore.reason,
  });

  // V5 (ia-moderne backlog): T+2/T+8 re-checks — every deploy that reaches
  // this point is already Solo+ (the deployHooks gate above 403s Free
  // before this), so no extra plan check is needed here.
  if (deployEventId) {
    await scheduleDeployWatches(supabase, projectId, deployEventId);
  }

  // Opt-in, and only when this specific webhook exposes a commit SHA — no
  // GitHub App, a fine-grained PAT (checks:write) the user pastes once.
  // Free doesn't get here at all (deployHooks gate above).
  const sha = event.payload?.deployment?.meta?.githubCommitSha;
  if (sha && project.github_repo && project.github_token_enc) {
    const failedCount = results.filter((r) => r.outcome !== "pass").length;
    const summary = results
      .map((r) =>
        r.outcome === "pass"
          ? `✅ ${r.url}`
          : describeAlertItem({
              url: r.url,
              kind: "fail",
              outcome: r.outcome,
              httpStatus: r.http_status,
              missing: r.missing,
            }),
      )
      .join("\n");

    await postGithubCheckRun({
      repo: project.github_repo,
      token: project.github_token_enc,
      sha,
      conclusion: failedCount === 0 ? "success" : "failure",
      title: `PostShip · ${shipScore.score}`,
      summary,
    });
  }

  return NextResponse.json({ triggered: true });
}
