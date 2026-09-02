import { NextResponse } from "next/server";
import { z } from "zod";
import { runHttpCheck } from "@/lib/checks/http";
import { createServiceClient } from "@/lib/db/service";
import { assertRegisterableHttpsUrl } from "@/lib/validation";

const RATE_LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

const bodySchema = z.object({ url: z.string() });

export async function POST(request: Request) {
  // x-real-ip is set by Vercel's edge to a single, unambiguous client IP.
  // x-forwarded-for can be a client-supplied chain (`client, proxy1, ...`)
  // — the leftmost entry is attacker-controlled; Vercel appends the
  // address it actually observed as the LAST entry, so that's the one
  // that's trustworthy if x-real-ip isn't present.
  const forwardedFor = request.headers.get("x-forwarded-for");
  const ip =
    request.headers.get("x-real-ip") ??
    forwardedFor?.split(",").pop()?.trim() ??
    "unknown";

  const supabase = createServiceClient();

  // Atomic check-and-insert (see migration 0019) — a plain
  // count-then-insert lets two concurrent requests from the same IP both
  // read a count under the limit and both get through.
  const { data: allowed, error: rpcError } = await supabase.rpc(
    "demo_check_allow",
    { p_ip: ip, p_limit: RATE_LIMIT, p_window_ms: WINDOW_MS },
  );

  if (rpcError || !allowed) {
    return NextResponse.json(
      { error: "Trop de vérifications. Réessayez plus tard." },
      { status: 429 },
    );
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: "URL invalide (https requis)." },
      { status: 400 },
    );
  }

  const urlCheck = await assertRegisterableHttpsUrl(parsed.data.url);
  if (!urlCheck.ok) {
    return NextResponse.json({ error: urlCheck.reason }, { status: 400 });
  }

  // Never used as an open proxy: the response only reveals pass/fail
  // metadata, not the fetched page's body (see docs/ARCHITECTURE.md).
  const result = await runHttpCheck({
    url: urlCheck.url,
    expect_status: 200,
    expect_contains: null,
    expect_not_contains: null,
  });

  return NextResponse.json({
    outcome: result.outcome,
    http_status: result.http_status,
    ttfb_ms: result.ttfb_ms,
  });
}
