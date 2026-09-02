import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/db/service";
import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { sendWeeklyDigests } from "@/lib/digest";

// F8a (features backlog): meant to be called by its own weekly external
// cron trigger (e.g. Monday 07:00 UTC), separate from the 5-minute
// /api/cron/tick — see .github/workflows/digest.yml for the backup
// schedule. digest_lock (migration 0039) makes repeated calls in the same
// week a no-op instead of double-sending.
const LOCK_ID = 1;
const LOCK_TTL_MS = 55_000;

type AcquireLockResult = "acquired" | "held" | "error";

async function acquireLock(
  supabase: ReturnType<typeof createServiceClient>,
): Promise<AcquireLockResult> {
  const now = new Date();
  const { data, error } = await supabase
    .from("digest_lock")
    .update({ locked_until: new Date(now.getTime() + LOCK_TTL_MS).toISOString() })
    .eq("id", LOCK_ID)
    .or(`locked_until.is.null,locked_until.lt.${now.toISOString()}`)
    .select("id");

  if (error) {
    console.error("Impossible d'acquérir le verrou digest", error);
    return "error";
  }

  return (data?.length ?? 0) > 0 ? "acquired" : "held";
}

async function releaseLock(supabase: ReturnType<typeof createServiceClient>) {
  await supabase.from("digest_lock").update({ locked_until: null }).eq("id", LOCK_ID);
}

export async function GET(request: Request) {
  if (!isAuthorizedCronRequest(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const lockResult = await acquireLock(supabase);
  if (lockResult === "error") {
    return NextResponse.json({ skipped: "lock_unavailable" }, { status: 503 });
  }
  if (lockResult === "held") {
    return NextResponse.json({ skipped: "digest already in progress" });
  }

  try {
    const { data: lock } = await supabase
      .from("digest_lock")
      .select("last_sent_date")
      .eq("id", LOCK_ID)
      .single();

    const today = new Date().toISOString().slice(0, 10);
    const lastSentDate = lock?.last_sent_date as string | null;

    if (lastSentDate) {
      const daysSinceLastSend =
        (new Date(today).getTime() - new Date(lastSentDate).getTime()) / (24 * 60 * 60 * 1000);
      if (daysSinceLastSend < 6) {
        return NextResponse.json({ skipped: "already_sent_this_week" });
      }
    }

    const { sent } = await sendWeeklyDigests();

    await supabase
      .from("digest_lock")
      .update({ last_sent_date: today })
      .eq("id", LOCK_ID);

    return NextResponse.json({ sent });
  } finally {
    await releaseLock(supabase);
  }
}
