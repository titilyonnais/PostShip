// The Vercel section of the console. Extends what admin-infra.ts already
// calls, with the parsing split out so it can be tested against a frozen
// payload rather than against the live API.
//
// Host is the literal api.vercel.com, not user input — nothing here goes
// through the SSRF guard, same reasoning as src/lib/github-check.ts.

const API = "https://api.vercel.com";
const TIMEOUT_MS = 10_000;

export type VercelDeployment = {
  uid: string;
  url: string;
  state: string;
  target: string | null;
  source: string | null;
  created: number;
  /** Milliseconds from build start to ready, when both are known. */
  durationMs: number | null;
  sha: string | null;
  shaShort: string | null;
  commitMessage: string | null;
  branch: string | null;
  author: string | null;
  aliasError: string | null;
  /** Vercel hands this back itself; no need to build a dashboard URL. */
  inspectorUrl: string | null;
};

export type VercelSnapshot = {
  configured: boolean;
  error: string | null;
  deployments: VercelDeployment[];
  latest: VercelDeployment | null;
  counts: { day: number; week: number; failedWeek: number };
};

type RawDeployment = {
  uid?: string;
  url?: string;
  state?: string;
  readyState?: string;
  target?: string | null;
  source?: string | null;
  created?: number;
  createdAt?: number;
  ready?: number;
  buildingAt?: number;
  aliasError?: { message?: string } | null;
  inspectorUrl?: string | null;
  meta?: Record<string, string | undefined>;
  creator?: { username?: string; email?: string };
};

export function parseDeployments(
  raw: unknown,
  now: number = Date.now(),
): Omit<VercelSnapshot, "configured" | "error"> {
  const list = ((raw as { deployments?: RawDeployment[] })?.deployments ?? []).map(
    (d): VercelDeployment => {
      const sha = d.meta?.githubCommitSha ?? null;
      return {
        uid: d.uid ?? "",
        url: d.url ?? "",
        // state and readyState carry the same value in practice; reading
        // both means a payload missing either still renders.
        state: d.state ?? d.readyState ?? "UNKNOWN",
        target: d.target ?? null,
        source: d.source ?? null,
        created: d.created ?? d.createdAt ?? 0,
        durationMs:
          typeof d.ready === "number" && typeof d.buildingAt === "number"
            ? d.ready - d.buildingAt
            : null,
        sha,
        shaShort: sha ? sha.slice(0, 7) : null,
        commitMessage: d.meta?.githubCommitMessage ?? null,
        branch: d.meta?.githubCommitRef ?? null,
        author: d.creator?.username ?? d.meta?.githubCommitAuthorName ?? null,
        aliasError: d.aliasError?.message ?? null,
        inspectorUrl: d.inspectorUrl ?? null,
      };
    },
  );

  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  const week = list.filter((d) => d.created >= weekAgo);

  return {
    deployments: list,
    latest: list[0] ?? null,
    counts: {
      day: list.filter((d) => d.created >= dayAgo).length,
      week: week.length,
      failedWeek: week.filter((d) => d.state === "ERROR").length,
    },
  };
}

export async function getVercelSnapshot(limit = 50): Promise<VercelSnapshot> {
  const token = process.env.VERCEL_API_TOKEN;
  const empty = {
    deployments: [],
    latest: null,
    counts: { day: 0, week: 0, failedWeek: 0 },
  };

  if (!token) return { configured: false, error: null, ...empty };

  // A project-scoped token (vcp_…) is refused on account-level endpoints
  // and only answers when the request names its team — see admin-infra.ts.
  const query = new URLSearchParams({ limit: String(limit) });
  if (process.env.VERCEL_TEAM_ID) query.set("teamId", process.env.VERCEL_TEAM_ID);
  if (process.env.VERCEL_PROJECT_ID) query.set("projectId", process.env.VERCEL_PROJECT_ID);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${API}/v6/deployments?${query.toString()}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: controller.signal,
    });

    if (!response.ok) {
      return {
        configured: true,
        error:
          response.status === 401 || response.status === 403
            ? "Jeton refusé par Vercel — expiré, ou VERCEL_TEAM_ID absent pour un jeton de projet."
            : `Vercel a répondu ${response.status}.`,
        ...empty,
      };
    }

    return { configured: true, error: null, ...parseDeployments(await response.json()) };
  } catch {
    return { configured: true, error: "Vercel n'a pas répondu.", ...empty };
  } finally {
    clearTimeout(timeout);
  }
}

export function formatDuration(ms: number | null): string {
  if (ms === null || ms < 0) return "—";
  const seconds = Math.round(ms / 1000);
  if (seconds < 60) return `${seconds} s`;
  return `${Math.floor(seconds / 60)} min ${String(seconds % 60).padStart(2, "0")} s`;
}
