import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/service";
import { recordDeployEvent } from "@/lib/deploys";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { isValidNetlifySignature } from "@/lib/netlify-webhook";
import { runProjectChecks } from "@/lib/runner";

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

  await recordDeployEvent(supabase, {
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
  });

  return NextResponse.json({ triggered: true });
}
