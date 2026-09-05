import { createServiceClient } from "@/lib/db/service";

// The writer for the unified journal. Every call site is somewhere that
// must not fail because logging failed — a Stripe webhook, a login, the
// runner — so nothing here ever throws or awaits anything the caller
// depends on.

export type OpsSource =
  | "console"
  | "auth"
  | "stripe"
  | "billing"
  | "runner"
  | "scan"
  | "admin_alert";

export type OpsSeverity = "info" | "warn" | "error" | "fraud";

export type OpsEvent = {
  source: OpsSource;
  severity?: OpsSeverity;
  /** Dotted and stable, e.g. "stripe.invoice.payment_failed". */
  action: string;
  actorAdminId?: string | null;
  actorUserId?: string | null;
  /** An email, a Stripe customer id, a project id — whatever identifies it. */
  target?: string | null;
  ip?: string | null;
  userAgent?: string | null;
  payload?: Record<string, unknown>;
};

export async function recordOpsEvent(event: OpsEvent): Promise<void> {
  try {
    const { error } = await createServiceClient().from("ops_events").insert({
      source: event.source,
      severity: event.severity ?? "info",
      action: event.action,
      actor_admin_id: event.actorAdminId ?? null,
      actor_user_id: event.actorUserId ?? null,
      target: event.target ?? null,
      ip: event.ip ?? null,
      user_agent: event.userAgent ?? null,
      payload: event.payload ?? {},
    });
    if (error) console.error("Échec écriture ops_events", event.action, error.message);
  } catch (err) {
    console.error("Échec écriture ops_events", event.action, err);
  }
}

// Some sources are chatty by nature. The runner sees the same project fail
// every cycle, and a row per cycle would drown the journal in the one
// event that is least informative the second time you see it. This keeps
// at most one row per (action, target) per window.
export async function recordOpsEventThrottled(
  event: OpsEvent,
  windowMs: number,
): Promise<void> {
  try {
    const since = new Date(Date.now() - windowMs).toISOString();
    const supabase = createServiceClient();

    const { count } = await supabase
      .from("ops_events")
      .select("id", { count: "exact", head: true })
      .eq("action", event.action)
      .eq("target", event.target ?? "")
      .gte("at", since);

    if ((count ?? 0) > 0) return;
    await recordOpsEvent(event);
  } catch (err) {
    console.error("Échec écriture ops_events (throttled)", event.action, err);
  }
}

export type OpsEventRow = {
  id: string;
  at: string;
  source: OpsSource;
  severity: OpsSeverity;
  action: string;
  actor_user_id: string | null;
  target: string | null;
  ip: string | null;
  user_agent: string | null;
  payload: Record<string, unknown>;
};

export type OpsQuery = {
  source?: string;
  severity?: string;
  /** Matched against action and target, case-insensitively. */
  q?: string;
  from?: string;
  to?: string;
  page?: number;
};

export const OPS_PAGE_SIZE = 100;

export async function queryOpsEvents(
  query: OpsQuery,
): Promise<{ rows: OpsEventRow[]; hasMore: boolean }> {
  const page = Math.max(0, query.page ?? 0);
  const supabase = createServiceClient();

  let request = supabase
    .from("ops_events")
    .select("id, at, source, severity, action, actor_user_id, target, ip, user_agent, payload")
    .order("at", { ascending: false })
    // One extra row is what tells us whether a next page exists, without
    // paying for a count over a table meant to grow without bound.
    .range(page * OPS_PAGE_SIZE, page * OPS_PAGE_SIZE + OPS_PAGE_SIZE);

  if (query.source) request = request.eq("source", query.source);
  if (query.severity) request = request.eq("severity", query.severity);
  if (query.from) request = request.gte("at", query.from);
  if (query.to) request = request.lte("at", query.to);
  if (query.q) {
    // Commas and parentheses would break out of PostgREST's or() syntax.
    const safe = query.q.replace(/[(),]/g, " ").trim();
    if (safe) request = request.or(`action.ilike.%${safe}%,target.ilike.%${safe}%`);
  }

  const { data, error } = await request;
  if (error) {
    console.error("Échec lecture ops_events", error.message);
    return { rows: [], hasMore: false };
  }

  const rows = (data ?? []) as OpsEventRow[];
  return { rows: rows.slice(0, OPS_PAGE_SIZE), hasMore: rows.length > OPS_PAGE_SIZE };
}
