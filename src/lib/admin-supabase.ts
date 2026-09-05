import { createServiceClient } from "@/lib/db/service";

// The Supabase section of the console. Three sources, deliberately kept
// apart because they fail independently: the Management API (project
// state), the Auth admin API (who exists), and plain SQL through the
// service role (what the database holds).
//
// No free SQL editor and no backup/restore buttons. Both are one typo
// away from an outage, and neither belongs behind a single password.

const API = "https://api.supabase.com";
const TIMEOUT_MS = 10_000;

export type SupabaseProjectInfo = {
  configured: boolean;
  error: string | null;
  name: string | null;
  status: string | null;
  region: string | null;
  postgresVersion: string | null;
  host: string | null;
  createdAt: string | null;
};

export async function getSupabaseProject(): Promise<SupabaseProjectInfo> {
  const token = process.env.SUPABASE_MANAGEMENT_TOKEN;
  const ref = process.env.SUPABASE_PROJECT_REF;
  const empty = {
    name: null,
    status: null,
    region: null,
    postgresVersion: null,
    host: null,
    createdAt: null,
  };

  if (!token || !ref) return { configured: false, error: null, ...empty };

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API}/v1/projects/${ref}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        configured: true,
        error:
          response.status === 401 || response.status === 403
            ? "Jeton refusé par Supabase — expiré, ou sans accès à ce projet."
            : `Supabase a répondu ${response.status}.`,
        ...empty,
      };
    }

    const body = (await response.json()) as {
      name?: string;
      status?: string;
      region?: string;
      created_at?: string;
      database?: { host?: string; version?: string };
    };

    return {
      configured: true,
      error: null,
      name: body.name ?? null,
      status: body.status ?? null,
      region: body.region ?? null,
      // Only reported because the endpoint actually returns it — not
      // inferred from anything.
      postgresVersion: body.database?.version ?? null,
      host: body.database?.host ?? null,
      createdAt: body.created_at ?? null,
    };
  } catch {
    return { configured: true, error: "Supabase n'a pas répondu.", ...empty };
  } finally {
    clearTimeout(timeout);
  }
}

export type AuthOverview = {
  ok: boolean;
  total: number;
  confirmed: number;
  banned: number;
  recent: { id: string; email: string | null; lastSignInAt: string | null }[];
};

export async function getAuthOverview(): Promise<AuthOverview> {
  const empty = { ok: false, total: 0, confirmed: 0, banned: 0, recent: [] };
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.auth.admin.listUsers({ page: 1, perPage: 200 });
    if (error || !data) return empty;

    const users = data.users;
    const now = Date.now();

    return {
      ok: true,
      total: users.length,
      confirmed: users.filter((u) => Boolean(u.email_confirmed_at)).length,
      // banned_until is a timestamp, not a flag: a ban that has expired is
      // still on the row and would otherwise be counted forever.
      banned: users.filter((u) => {
        const until = (u as { banned_until?: string | null }).banned_until;
        return Boolean(until) && new Date(until!).getTime() > now;
      }).length,
      recent: [...users]
        .sort(
          (a, b) =>
            new Date(b.last_sign_in_at ?? 0).getTime() -
            new Date(a.last_sign_in_at ?? 0).getTime(),
        )
        .slice(0, 20)
        .map((u) => ({
          id: u.id,
          email: u.email ?? null,
          lastSignInAt: u.last_sign_in_at ?? null,
        })),
    };
  } catch {
    return empty;
  }
}

export type DatabaseOverview = {
  serviceRoleOk: boolean;
  profiles: number;
  projects: number;
  checkRuns24h: number;
  alertEvents24h: number;
  opsEvents24h: number;
  tables: { name: string; bytes: number; rows: number }[];
};

export async function getDatabaseOverview(): Promise<DatabaseOverview> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const supabase = createServiceClient();

  try {
    const [profiles, projects, runs, alerts, ops, sizes] = await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("projects").select("id", { count: "exact", head: true }),
      supabase
        .from("check_runs")
        .select("id", { count: "exact", head: true })
        .gte("started_at", since),
      supabase
        .from("alert_events")
        .select("id", { count: "exact", head: true })
        .gte("sent_at", since),
      supabase.from("ops_events").select("id", { count: "exact", head: true }).gte("at", since),
      supabase.rpc("admin_table_sizes"),
    ]);

    return {
      // If the simplest possible read fails, nothing else on this page is
      // trustworthy either — say so rather than showing zeros.
      serviceRoleOk: !profiles.error,
      profiles: profiles.count ?? 0,
      projects: projects.count ?? 0,
      checkRuns24h: runs.count ?? 0,
      alertEvents24h: alerts.count ?? 0,
      opsEvents24h: ops.count ?? 0,
      tables: ((sizes.data ?? []) as {
        table_name: string;
        total_bytes: number;
        row_estimate: number;
      }[]).map((t) => ({
        name: t.table_name,
        bytes: Number(t.total_bytes),
        rows: Number(t.row_estimate),
      })),
    };
  } catch {
    return {
      serviceRoleOk: false,
      profiles: 0,
      projects: 0,
      checkRuns24h: 0,
      alertEvents24h: 0,
      opsEvents24h: 0,
      tables: [],
    };
  }
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} o`;
  const units = ["ko", "Mo", "Go"];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
}
