import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/service";
import { recordDeployEvent } from "@/lib/deploys";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { runProjectChecks } from "@/lib/runner";

// Cloudflare's webhook destinations don't sign the payload — the secret
// generated when you create the destination is sent back verbatim in the
// cf-webhook-auth header on every delivery.
// https://developers.cloudflare.com/notifications/get-started/configure-webhooks/
function isValidCloudflareAuth(secret: string, header: string | null): boolean {
  if (!header) return false;
  const expected = Buffer.from(secret);
  const provided = Buffer.from(header);
  return (
    expected.length === provided.length && timingSafeEqual(expected, provided)
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;
  const header = request.headers.get("cf-webhook-auth");

  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, cloudflare_hook_secret, profiles(plan)")
    .eq("id", projectId)
    .single();

  if (!project?.cloudflare_hook_secret) {
    return NextResponse.json({ error: "Not configured" }, { status: 404 });
  }

  if (!isValidCloudflareAuth(project.cloudflare_hook_secret, header)) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const owner = project.profiles as unknown as { plan: Plan } | null;
  if (!getPlanLimits(owner?.plan ?? "free").deployHooks) {
    return NextResponse.json({ error: "Plan does not include this" }, { status: 403 });
  }

  // No documented payload schema to filter on — the Notification Policy is
  // scoped to "Pages Deployment Success" specifically at setup time on
  // Cloudflare's side, so an authenticated delivery here already IS that
  // event.
  let results: Awaited<ReturnType<typeof runProjectChecks>>;
  try {
    results = await runProjectChecks(
      projectId,
      undefined,
      `deploy Cloudflare Pages ${new Date().toLocaleTimeString("fr-FR", { timeZone: "Europe/Paris" })}`,
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Check failed" },
      { status: 500 },
    );
  }

  await recordDeployEvent(supabase, {
    projectId,
    provider: "cloudflare",
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
  });

  return NextResponse.json({ triggered: true });
}
