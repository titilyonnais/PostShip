import { NextResponse } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/db/service";

export const runtime = "nodejs";

// The client half of a visit, sent by navigator.sendBeacon when the page
// is left. Unlike /api/track this one does trust a body, because these
// values only exist in the browser — so every field is parsed and bounded
// before it goes anywhere near the database.
const schema = z.object({
  path: z.string().max(512),
  screenW: z.number().int().min(0).max(20000),
  screenH: z.number().int().min(0).max(20000),
  viewportW: z.number().int().min(0).max(20000),
  viewportH: z.number().int().min(0).max(20000),
  pixelRatio: z.number().min(0).max(10),
  timezone: z.string().max(64),
  connection: z.string().max(16).nullable(),
  engagementMs: z.number().int().min(0).max(1_800_000),
});

export async function POST(request: Request) {
  let parsed;
  try {
    parsed = schema.safeParse(await request.json());
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  if (!parsed.success) return NextResponse.json({ ok: false }, { status: 400 });

  const body = parsed.data;
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",").pop()?.trim() ??
    "unknown";

  try {
    const supabase = createServiceClient();

    // Attach to this visitor's most recent view of this path, within a
    // short window. Matching on the id would mean handing the browser a
    // row id to echo back, which is a row anyone could then overwrite.
    const { data: visit } = await supabase
      .from("visits")
      .select("id")
      .eq("ip", ip)
      .eq("path", body.path)
      .gte("at", new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order("at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!visit) return NextResponse.json({ ok: true });

    await supabase.rpc("record_visit_client", {
      p_visit_id: visit.id,
      p_screen_w: body.screenW,
      p_screen_h: body.screenH,
      p_viewport_w: body.viewportW,
      p_viewport_h: body.viewportH,
      p_pixel_ratio: body.pixelRatio,
      p_timezone: body.timezone,
      p_connection: body.connection,
      p_engagement_ms: body.engagementMs,
    });
  } catch (err) {
    console.error("Échec enregistrement des signaux client", err);
  }

  return NextResponse.json({ ok: true });
}
