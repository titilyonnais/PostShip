import { NextResponse } from "next/server";
import { z } from "zod";
import { runHttpCheck } from "@/lib/checks/http";
import { createServiceClient } from "@/lib/db/service";
import { httpsUrlSchema } from "@/lib/validation";

const RATE_LIMIT = 5;
const WINDOW_MS = 60 * 60 * 1000;

const bodySchema = z.object({ url: httpsUrlSchema });

export async function POST(request: Request) {
  const ip =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "unknown";

  const supabase = createServiceClient();
  const since = new Date(Date.now() - WINDOW_MS).toISOString();

  const { count } = await supabase
    .from("demo_checks")
    .select("id", { count: "exact", head: true })
    .eq("ip", ip)
    .gte("created_at", since);

  if ((count ?? 0) >= RATE_LIMIT) {
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

  await supabase.from("demo_checks").insert({ ip });

  // Never used as an open proxy: the response only reveals pass/fail
  // metadata, not the fetched page's body (see docs/ARCHITECTURE.md).
  const result = await runHttpCheck({
    url: parsed.data.url,
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
