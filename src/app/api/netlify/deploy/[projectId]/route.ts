import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/service";
import {
  recordDeployEvent,
  recordDeployHookReceipt,
  scheduleDeployWatches,
} from "@/lib/deploys";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { isValidNetlifySignature } from "@/lib/netlify-webhook";
import { runProjectChecks } from "@/lib/runner";
import { computeShipScore } from "@/lib/ship-score";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature");

  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, netlify_hook_secret, profiles(plan)")
    .eq("id", projectId)
    .single();

  if (!project?.netlify_hook_secret) {
    return NextResponse.json({ error: "Not configured" }, { status: 404 });
  }

  if (!isValidNetlifySignature(rawBody, project.netlify_hook_secret, signature)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // The signature verified, so this really is Netlify talking to us —
  // that alone is what Intégrations reports, whatever the event turns
  // out to be below.
  await recordDeployHookReceipt(supabase, projectId, "netlify");

  const owner = project.profiles as unknown as { plan: Plan } | null;
  if (!getPlanLimits(owner?.plan ?? "free").deployHooks) {
    return NextResponse.json({ error: "Plan does not include this" }, { status: 403 });
  }

  // Unlike Vercel's single webhook carrying multiple event types (filtered
  // by event.type below there), Netlify's notification is created against
  // one specific trigger event ("Deploy succeeded") at setup time — a
  // validly-signed request here already IS that event by construction.
  let results: Awaited<ReturnType<typeof runProjectChecks>>;
  try {
    results = await runProjectChecks(
      projectId,
      undefined,
      `deploy Netlify ${new Date().toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" })}`,
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Check failed" },
      { status: 500 },
    );
  }

  const shipScore = computeShipScore(results);

  const deployEventId = await recordDeployEvent(supabase, {
    projectId,
    provider: "netlify",
    kind: "production",
    sha: null,
    deploymentUrl: null,
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

  // V5 (ia-moderne backlog): every deploy that reaches this point is
  // already Solo+ (the deployHooks gate above 403s Free before this).
  if (deployEventId) {
    await scheduleDeployWatches(supabase, projectId, deployEventId);
  }

  return NextResponse.json({ triggered: true });
}
