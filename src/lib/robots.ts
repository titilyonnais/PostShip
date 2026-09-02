import { assertPublicHttpsUrl } from "@/lib/ssrf";
import { guardedFetch, MAX_BODY_BYTES, readBodyCapped, TIMEOUT_MS } from "@/lib/checks/shared";
import type { FetchBudget } from "@/lib/budgets";

export const ROBOTS_USER_AGENT = "postshipbot";

// Deliberately simplified: groups by exact User-agent token match (our own
// "PostShipBot" first, falling back to "*"), Disallow as a plain path
// prefix. No Allow-rule precedence, no wildcard/$ patterns — covers the
// overwhelming majority of real-world robots.txt files without pulling in
// a parser dependency for a courtesy check, not a strict-compliance one.
export function parseRobotsDisallow(text: string, userAgent: string): string[] {
  type Group = { agents: string[]; disallow: string[] };
  const groups: Group[] = [];
  let current: Group | null = null;
  let sawDirectiveSinceLastAgent = false;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.split("#")[0].trim();
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim().toLowerCase();
    const value = line.slice(idx + 1).trim();

    if (key === "user-agent") {
      if (!current || sawDirectiveSinceLastAgent) {
        current = { agents: [], disallow: [] };
        groups.push(current);
        sawDirectiveSinceLastAgent = false;
      }
      current.agents.push(value.toLowerCase());
    } else if (key === "disallow" && current) {
      sawDirectiveSinceLastAgent = true;
      if (value) current.disallow.push(value);
    } else if (current) {
      sawDirectiveSinceLastAgent = true;
    }
  }

  const uaLower = userAgent.toLowerCase();
  const specific = groups.find((g) => g.agents.includes(uaLower));
  const wildcard = groups.find((g) => g.agents.includes("*"));
  return (specific ?? wildcard)?.disallow ?? [];
}

export function isDisallowed(pathname: string, disallowRules: string[]): boolean {
  return disallowRules.some((rule) => rule !== "" && pathname.startsWith(rule));
}

// Fetches and parses robots.txt for one origin. Callers that need to check
// many URLs against the same origin should call this once and reuse the
// result — it's not cached here.
export async function fetchRobotsDisallowRules(
  origin: string,
  budget?: FetchBudget,
): Promise<string[]> {
  const robotsUrl = `${origin}/robots.txt`;
  const guard = await assertPublicHttpsUrl(robotsUrl);
  if (!guard.ok) return [];

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await guardedFetch(robotsUrl, { signal: controller.signal, budget });
    if (!res.ok) return [];
    const { text } = await readBodyCapped(res.response, MAX_BODY_BYTES);
    return parseRobotsDisallow(text, ROBOTS_USER_AGENT);
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
}
