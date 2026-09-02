import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/db/service";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { assertPublicHttpsUrl } from "@/lib/ssrf";
import { guardedFetch, TIMEOUT_MS } from "@/lib/checks/shared";
import type { MoneyPathAssertions } from "@/lib/checks/http";

const PRICING_PATHS = ["/pricing", "/tarifs", "/prices"];
const LOGIN_PATHS = ["/login", "/signin", "/auth/login"];
const CHECKOUT_PATH = "/checkout";

export type MoneyPathOptions = {
  includePricing: boolean;
  includeLogin: boolean;
  includeCheckout: boolean;
  priceToken: string;
};

export type MoneyPathResult = {
  created: number;
  attempted: number;
  quotaLimited: boolean;
};

type CandidateTarget = {
  url: string;
  assertions: MoneyPathAssertions;
};

// Registration only needs to know which candidate path actually responds —
// full assertion evaluation happens on the target's regular checks
// afterwards (runner.ts), not here.
async function findFirstReachablePath(
  origin: string,
  paths: string[],
): Promise<string | null> {
  for (const path of paths) {
    let url: string;
    try {
      url = new URL(path, origin).toString();
    } catch {
      continue;
    }

    const guard = await assertPublicHttpsUrl(url);
    if (!guard.ok) continue;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      let result = await guardedFetch(url, { signal: controller.signal, method: "HEAD" });
      if (result.ok && result.response.status === 405) {
        result = await guardedFetch(url, { signal: controller.signal, method: "GET" });
      }
      if (result.ok && result.response.status < 400) return url;
    } catch {
      // try the next candidate
    } finally {
      clearTimeout(timeout);
    }
  }
  return null;
}

// Called by the "Ajouter le pack argent" server action. `supabase` is the
// caller's own session client (RLS enforces project ownership on the
// insert, same as addTarget) — a service client is only used internally
// for the owner-plan/quota lookup, mirroring addTarget's reasoning: quota
// is governed by the project owner's plan and total URL count, which a
// collaborator's session can't see via RLS.
export async function applyMoneyPath(
  supabase: SupabaseClient,
  projectId: string,
  baseUrl: string,
  options: MoneyPathOptions,
): Promise<MoneyPathResult> {
  let origin: string;
  try {
    origin = new URL(baseUrl).origin;
  } catch {
    return { created: 0, attempted: 0, quotaLimited: false };
  }

  const { data: existing } = await supabase
    .from("check_targets")
    .select("url")
    .eq("project_id", projectId);
  const existingUrls = new Set((existing ?? []).map((t) => t.url));

  const candidates: CandidateTarget[] = [];

  if (!existingUrls.has(`${origin}/`)) {
    candidates.push({ url: `${origin}/`, assertions: {} });
  }

  if (options.includePricing) {
    const pricingUrl = await findFirstReachablePath(origin, PRICING_PATHS);
    if (pricingUrl && !existingUrls.has(pricingUrl)) {
      candidates.push({
        url: pricingUrl,
        assertions: { requirePriceToken: options.priceToken || "€" },
      });
    }
  }

  if (options.includeLogin) {
    const loginUrl = await findFirstReachablePath(origin, LOGIN_PATHS);
    if (loginUrl && !existingUrls.has(loginUrl)) {
      candidates.push({
        url: loginUrl,
        assertions: { requireEmailOrPasswordInput: true },
      });
    }
  }

  if (options.includeCheckout) {
    const checkoutUrl = await findFirstReachablePath(origin, [CHECKOUT_PATH]);
    if (checkoutUrl && !existingUrls.has(checkoutUrl)) {
      candidates.push({
        url: checkoutUrl,
        assertions: { requireStripeJs: true },
      });
    }
  }

  if (candidates.length === 0) {
    return { created: 0, attempted: 0, quotaLimited: false };
  }

  const service = createServiceClient();
  const { data: project } = await service
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { created: 0, attempted: candidates.length, quotaLimited: false };
  }

  const { data: ownerProfile } = await service
    .from("profiles")
    .select("plan")
    .eq("id", project.user_id)
    .single();
  const limits = getPlanLimits((ownerProfile?.plan as Plan) ?? "free");

  const { count } = await service
    .from("check_targets")
    .select("id, projects!inner(user_id)", { count: "exact", head: true })
    .eq("projects.user_id", project.user_id);

  const remaining = Math.max(0, limits.urls - (count ?? 0));
  const toCreate = candidates.slice(0, remaining);

  if (toCreate.length === 0) {
    return { created: 0, attempted: candidates.length, quotaLimited: true };
  }

  const { error } = await supabase.from("check_targets").insert(
    toCreate.map((c) => ({
      project_id: projectId,
      kind: "http" as const,
      url: c.url,
      expect_status: 200,
      expect_contains: null,
      expect_not_contains: null,
      assertions: c.assertions,
    })),
  );

  if (error) {
    return { created: 0, attempted: candidates.length, quotaLimited: false };
  }

  return {
    created: toCreate.length,
    attempted: candidates.length,
    quotaLimited: toCreate.length < candidates.length,
  };
}
