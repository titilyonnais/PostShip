import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/service";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { runProjectChecks } from "@/lib/runner";

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
    .select("id, vercel_hook_secret, profiles(plan)")
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

  let event: { type?: string };
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

  try {
    await runProjectChecks(projectId);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Check failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ triggered: true });
}
