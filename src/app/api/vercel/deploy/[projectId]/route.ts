import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/service";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { runPreviewChecks, runProjectChecks } from "@/lib/runner";

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
    .select("id, base_url, vercel_hook_secret, check_previews, profiles(plan)")
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

  // Same domain-ownership gate as the cron tick — a valid deploy-webhook
  // signature only proves the caller knows the secret, not that the
  // project's base_url actually belongs to them.
  let host: string;
  try {
    host = new URL(project.base_url).hostname;
  } catch {
    return NextResponse.json({ error: "Invalid project base_url" }, { status: 500 });
  }

  const { data: verification } = await supabase
    .from("domain_verifications")
    .select("verified_at")
    .eq("project_id", projectId)
    .eq("host", host)
    .maybeSingle();

  if (!verification?.verified_at) {
    return NextResponse.json({ skipped: "domain_not_verified" });
  }

  // Fields confirmed against Vercel's own webhook docs
  // (vercel.com/docs/webhooks/webhooks-api) — payload.target is
  // "production" | "staging" | null, payload.deployment.url is the
  // deployment's own hostname (no protocol).
  let event: {
    type?: string;
    payload?: { target?: string | null; deployment?: { url?: string } };
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
      return NextResponse.json({ triggered: true, preview: true, ...result });
    } catch (err) {
      return NextResponse.json(
        { error: err instanceof Error ? err.message : "Check failed" },
        { status: 500 },
      );
    }
  }

  try {
    await runProjectChecks(
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

  return NextResponse.json({ triggered: true });
}
