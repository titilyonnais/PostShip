"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { fetchDomainExpiry } from "@/lib/checks/rdap";
import { resolveDnsSnapshot } from "@/lib/checks/dns";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { assertSameSiteHost } from "@/lib/host-match";
import { registerTelegramWebhook } from "@/lib/telegram";
import { applyMoneyPath } from "@/lib/money-path";
import { runOneTarget, runProjectChecks } from "@/lib/runner";
import { createServiceClient } from "@/lib/db/service";
import { sendOutboundWebhook } from "@/lib/outbound-webhook";
import { assertPublicHttpsUrl } from "@/lib/ssrf";
import type { ActionResult } from "@/lib/use-toast-action";
import { assertRegisterableHttpsUrl } from "@/lib/validation";
import { discordWebhookSchema, slackWebhookSchema } from "@/lib/webhook-url-schemas";

// discord_webhook_url, slack_webhook_url, and the deploy-hook secret
// columns are service-role-only (see migrations 0017 and 0021) — the "own
// projects" RLS policy is `for all`, so leaving them user-writable would
// let a direct PostgREST call bypass the Discord/Slack-domain regexes and
// plan gating below (discord_webhook_url and slack_webhook_url are
// fetched directly by src/lib/alerts.ts, making a bypassed value a stored
// SSRF target). Every write to these columns must go through this
// ownership check first — createServiceClient() bypasses RLS entirely.
async function assertOwnsProject(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .single();
  return !!data;
}

const telegramTokenSchema = z
  .string()
  .trim()
  .regex(/^\d+:[A-Za-z0-9_-]+$/, "Token de bot Telegram invalide.");

const telegramChatIdSchema = z
  .string()
  .trim()
  .regex(/^-?\d+$/, "Chat ID Telegram invalide.");

const TARGET_KINDS = ["http", "og", "sitemap", "ssl", "stripe_health"] as const;
const RUN_NOW_COOLDOWN_MS = 30_000;
const TARGET_COOLDOWN_MS = 10_000;

// F6 (features backlog): a fixed allowlist of header names a monitoring
// check may send — refuses anything that could tamper with the request
// itself (Host, Content-Length) or leak/replay a session (Cookie,
// X-Forwarded-For).
const ALLOWED_REQUEST_HEADER_NAMES = [
  "Authorization",
  "X-Monitoring-Key",
  "X-Health-Token",
  "X-Api-Key",
];

const addTargetSchema = z.object({
  kind: z.enum(TARGET_KINDS).default("http"),
  // Only meaningful for kind "http" — the runner ignores these for every
  // other check type (see src/lib/checks/http.ts).
  expect_status: z.coerce.number().int().min(100).max(599).default(200),
  expect_contains: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null),
  expect_not_contains: z
    .string()
    .trim()
    .max(200)
    .transform((v) => (v === "" ? null : v))
    .nullable()
    .default(null),
});

export type TargetFormState = { error: string | null };

export async function addTarget(
  projectId: string,
  _prevState: TargetFormState,
  formData: FormData,
): Promise<TargetFormState> {
  const parsed = addTargetSchema.safeParse({
    kind: formData.get("kind") || undefined,
    expect_status: formData.get("expect_status") || undefined,
    expect_contains: formData.get("expect_contains") ?? undefined,
    expect_not_contains: formData.get("expect_not_contains") ?? undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Formulaire invalide.",
    };
  }

  const rawUrl = formData.get("url");
  const urlCheck = await assertRegisterableHttpsUrl(
    typeof rawUrl === "string" ? rawUrl : "",
  );
  if (!urlCheck.ok) {
    return { error: urlCheck.reason };
  }

  const rawHeaderName = formData.get("request_header_name");
  const rawHeaderValue = formData.get("request_header_value");
  const headerName = typeof rawHeaderName === "string" ? rawHeaderName.trim() : "";
  const headerValue = typeof rawHeaderValue === "string" ? rawHeaderValue.trim() : "";
  const hasHeader = !!headerName || !!headerValue;

  if (hasHeader) {
    if (!headerName || !headerValue) {
      return { error: "Nom et valeur du header requis ensemble." };
    }
    if (!ALLOWED_REQUEST_HEADER_NAMES.includes(headerName)) {
      return {
        error: `Nom de header non autorisé. Choix possibles : ${ALLOWED_REQUEST_HEADER_NAMES.join(", ")}.`,
      };
    }
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id, base_url")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { error: "Projet introuvable." };
  }

  // V4 (ia-moderne backlog): replaces the domain-verification ritual — the
  // URL must live on the project's own base_url host (or a subdomain of
  // it), so PostShip can't be used as a free scheduled HTTP client against
  // a domain the caller doesn't control.
  const hostMatch = assertSameSiteHost(urlCheck.url, project.base_url);
  if (!hostMatch.ok) {
    return { error: hostMatch.reason };
  }

  // Quota is governed by the project OWNER's plan and their total URL
  // count across all of *their* projects — not the current viewer's own
  // plan/targets. A collaborator's session can't see the owner's other
  // projects via RLS to count them, so this deliberately goes through the
  // service role, scoped explicitly to project.user_id.
  const service = createServiceClient();
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

  if ((count ?? 0) >= limits.urls) {
    return {
      error: `Limite de ${limits.urls} URL(s) atteinte pour votre plan.`,
    };
  }

  if (parsed.data.kind === "stripe_health" && !limits.stripeHealth) {
    return {
      error: "Stripe health n'est disponible qu'avec le plan Team.",
    };
  }

  // request_header_value is service-role-only (migration 0037) — the
  // insert goes through the service client once a header is set, ownership
  // already having been confirmed above via the user's own client.
  const writer = hasHeader ? service : supabase;
  const { error } = await writer.from("check_targets").insert({
    project_id: projectId,
    url: urlCheck.url,
    kind: parsed.data.kind,
    expect_status: parsed.data.expect_status,
    expect_contains: parsed.data.expect_contains,
    expect_not_contains: parsed.data.expect_not_contains,
    ...(hasHeader
      ? { request_header_name: headerName, request_header_value: headerValue }
      : {}),
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/${projectId}`);
  return { error: null };
}

export async function addMoneyPathPreset(
  projectId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("base_url")
    .eq("id", projectId)
    .single();

  if (!project) return { error: "Projet introuvable." };

  const priceToken = formData.get("price_token");

  const result = await applyMoneyPath(supabase, projectId, project.base_url, {
    includePricing: formData.get("pricing") === "on",
    includeLogin: formData.get("login") === "on",
    includeCheckout: formData.get("checkout") === "on",
    priceToken: typeof priceToken === "string" && priceToken.trim() ? priceToken.trim() : "€",
  });

  revalidatePath(`/app/${projectId}`);

  if (result.attempted === 0) {
    return { error: "Aucune URL à ajouter (déjà présentes ou aucune option cochée)." };
  }

  if (result.created === 0) {
    return { error: "Pack argent : quota atteint, passez Solo pour tout couvrir." };
  }

  if (result.quotaLimited) {
    return {
      success: `Pack partiel : ${result.created}/${result.attempted} URL(s) ajoutée(s) — quota atteint, passez Solo pour tout couvrir.`,
    };
  }

  return { success: `${result.created} URL(s) du pack argent ajoutée(s).` };
}

export async function runProjectNow(
  projectId: string,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, last_checked_at")
    .eq("id", projectId)
    .single();

  if (!project) return { error: "Projet introuvable." };

  if (project.last_checked_at) {
    const elapsedMs = Date.now() - new Date(project.last_checked_at).getTime();
    if (elapsedMs < RUN_NOW_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RUN_NOW_COOLDOWN_MS - elapsedMs) / 1000);
      return { error: `Patientez ${waitSeconds}s avant de relancer.` };
    }
  }

  let results: Awaited<ReturnType<typeof runProjectChecks>>;
  try {
    results = await runProjectChecks(projectId);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Erreur pendant l'exécution.",
    };
  }

  revalidatePath("/app");
  revalidatePath(`/app/${projectId}`);

  if (results.length === 0) {
    return { success: "Vérification lancée — aucune URL active à tester." };
  }

  const passed = results.filter((r) => r.outcome === "pass").length;
  const failed = results.length - passed;
  return {
    success:
      `Vérification terminée : ${passed}/${results.length} OK` +
      (failed > 0 ? `, ${failed} en échec.` : "."),
  };
}

export async function runTargetNow(
  projectId: string,
  targetId: string,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: target } = await supabase
    .from("check_targets")
    .select("id, url")
    .eq("id", targetId)
    .eq("project_id", projectId)
    .single();

  if (!target) return { error: "URL introuvable." };

  const { data: lastRun } = await supabase
    .from("check_runs")
    .select("started_at")
    .eq("target_id", targetId)
    .order("started_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (lastRun) {
    const elapsedMs = Date.now() - new Date(lastRun.started_at).getTime();
    if (elapsedMs < TARGET_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((TARGET_COOLDOWN_MS - elapsedMs) / 1000);
      return { error: `Patientez ${waitSeconds}s avant de relancer cette URL.` };
    }
  }

  let result: Awaited<ReturnType<typeof runOneTarget>>;
  try {
    result = await runOneTarget(targetId);
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : "Erreur pendant l'exécution.",
    };
  }

  revalidatePath(`/app/${projectId}`);
  revalidatePath("/app");

  // null means the check never ran because the plan doesn't cover it —
  // saying "OK" or "échec" would both be untrue.
  if (!result) {
    return {
      error: `${target.url} n'est pas vérifiée : ce type de check demande le plan Team.`,
    };
  }

  return {
    success:
      result.outcome === "pass"
        ? `OK — ${target.url}`
        : `Échec détecté — ${target.url}`,
  };
}

// B2 (app-bar backlog): the app-bar's "Recalculer" action on Santé —
// bypasses getHealthSnapshot's 6h cache (src/lib/health.ts) by inserting a
// fresh row directly, same DNS/RDAP fetches the cache-miss path already
// does.
export async function recomputeHealthNow(
  projectId: string,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, base_url")
    .eq("id", projectId)
    .single();

  if (!project) return { error: "Projet introuvable." };

  let hostname: string;
  try {
    hostname = new URL(project.base_url).hostname;
  } catch {
    return { error: "URL de base invalide." };
  }

  const [dns, domainExpiry] = await Promise.all([
    resolveDnsSnapshot(hostname),
    fetchDomainExpiry(hostname),
  ]);

  const { error } = await createServiceClient()
    .from("health_snapshots")
    .insert({ project_id: projectId, payload: { dns, domainExpiry } });

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}/health`);
  return { success: "Santé recalculée." };
}

async function setDeployHookSecret(
  column: "vercel_hook_secret" | "cloudflare_hook_secret",
  providerLabel: string,
  projectId: string,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = z
    .string()
    .trim()
    .min(1, "Secret invalide.")
    .safeParse(formData.get(column));

  if (!parsed.success) return { error: "Secret invalide." };

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { error: "Projet introuvable." };
  }

  const { data: ownerProfile } = await createServiceClient()
    .from("profiles")
    .select("plan")
    .eq("id", project.user_id)
    .single();

  if (!getPlanLimits((ownerProfile?.plan as Plan) ?? "free").deployHooks) {
    return { error: `${providerLabel} n'est disponible qu'avec un plan payant.` };
  }

  const { error } = await createServiceClient()
    .from("projects")
    .update({ [column]: parsed.data })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}`);
  return { success: `Secret ${providerLabel} enregistré.` };
}

const githubRepoSchema = z
  .string()
  .trim()
  .regex(/^[\w.-]+\/[\w.-]+$/, "Format attendu : owner/repo.");

export async function disableGithubCheck(
  projectId: string,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!(await assertOwnsProject(supabase, projectId))) {
    return { error: "Projet introuvable." };
  }

  const { error } = await createServiceClient()
    .from("projects")
    .update({ github_repo: null, github_token_enc: null, github_installation_id: null })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}`);
  return { success: "Check GitHub désactivé." };
}

export async function setGithubCheck(
  projectId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const rawRepo = formData.get("github_repo");
  const rawToken = formData.get("github_token");
  const hasRepo = typeof rawRepo === "string" && rawRepo.trim() !== "";
  const hasToken = typeof rawToken === "string" && rawToken.trim() !== "";

  if (!hasRepo && !hasToken) {
    return { success: "Aucun changement." };
  }

  const update: Record<string, string> = {};

  if (hasRepo) {
    const parsed = githubRepoSchema.safeParse(rawRepo);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Dépôt invalide." };
    }
    update.github_repo = parsed.data;
  }

  // Optional since the GitHub App landed: an installation mints its own
  // per-run token, so the only people who still paste one here are those
  // set up before it existed, or who prefer a PAT they control.
  if (hasToken) {
    const parsed = z.string().trim().min(1, "Token invalide.").safeParse(rawToken);
    if (!parsed.success) {
      return { error: "Token invalide." };
    }
    update.github_token_enc = parsed.data;
  }

  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { error: "Projet introuvable." };
  }

  const service = createServiceClient();
  const { data: ownerProfile } = await service
    .from("profiles")
    .select("plan")
    .eq("id", project.user_id)
    .single();

  if (!getPlanLimits((ownerProfile?.plan as Plan) ?? "free").deployHooks) {
    return { error: "Le check GitHub n'est disponible qu'avec un plan payant." };
  }

  // Neither credential present means nothing would ever post a Check Run,
  // so say so instead of saving a repo that silently does nothing.
  if (!hasToken) {
    const { data: existing } = await service
      .from("projects")
      .select("github_token_enc, github_installation_id")
      .eq("id", projectId)
      .single();

    if (!existing?.github_token_enc && !existing?.github_installation_id) {
      return {
        error: "Installez l'app GitHub ou collez un token avant d'enregistrer le dépôt.",
      };
    }
  }

  const { error } = await service.from("projects").update(update).eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}/integrations`);
  return { success: "Check GitHub enregistré." };
}

export async function setVercelHookSecret(
  projectId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return setDeployHookSecret("vercel_hook_secret", "Vercel", projectId, formData);
}

// Netlify is the one provider where the secret is invented by whoever
// sets it up rather than handed over by the provider: its "JWS secret
// token" field is a free-text box. Asking a user to think one up is how
// you get "postship123" — so PostShip generates it and the user pastes
// our value into Netlify, the reverse direction of Vercel/Cloudflare.
// Shown exactly once, same contract as the outbound webhook secret.
export async function generateNetlifyHookSecret(
  projectId: string,
  _prevState: RegenerateSecretResult,
): Promise<RegenerateSecretResult> {
  const supabase = await createClient();
  const { data: project } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .single();

  if (!project) return { error: "Projet introuvable." };

  const { data: ownerProfile } = await createServiceClient()
    .from("profiles")
    .select("plan")
    .eq("id", project.user_id)
    .single();

  if (!getPlanLimits((ownerProfile?.plan as Plan) ?? "free").deployHooks) {
    return { error: "Netlify n'est disponible qu'avec un plan payant." };
  }

  const secret = randomBytes(32).toString("hex");

  const { error } = await createServiceClient()
    .from("projects")
    .update({ netlify_hook_secret: secret })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}/integrations`);
  return {
    success: "Secret généré — collez-le dans Netlify, il ne sera plus réaffiché.",
    secret,
  };
}

export async function setCloudflareHookSecret(
  projectId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return setDeployHookSecret(
    "cloudflare_hook_secret",
    "Cloudflare",
    projectId,
    formData,
  );
}

async function disableChatWebhook(
  column: "discord_webhook_url" | "slack_webhook_url",
  providerLabel: string,
  projectId: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!(await assertOwnsProject(supabase, projectId))) {
    return { error: "Projet introuvable." };
  }

  const { error } = await createServiceClient()
    .from("projects")
    .update({ [column]: null })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}`);
  return { success: `Webhook ${providerLabel} désactivé.` };
}

async function setChatWebhook(
  column: "discord_webhook_url" | "slack_webhook_url",
  providerLabel: string,
  schema: typeof discordWebhookSchema,
  projectId: string,
  formData: FormData,
): Promise<ActionResult> {
  const raw = formData.get(column);

  // The input never carries the existing URL back to the browser (see the
  // settings page — it's shown as a masked placeholder instead), so an
  // empty submit here means "left untouched," not "clear it." Disabling
  // has its own explicit action/button.
  if (raw === "" || raw === null) {
    return { success: "Aucun changement." };
  }

  const parsed = schema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "URL invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // project.user_id (the owner), not the current viewer — see the same
  // reasoning in addTarget above.
  const { data: project } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { error: "Projet introuvable." };
  }

  const { data: ownerProfile } = await createServiceClient()
    .from("profiles")
    .select("plan")
    .eq("id", project.user_id)
    .single();

  if (!getPlanLimits((ownerProfile?.plan as Plan) ?? "free").chatWebhooks) {
    return { error: `${providerLabel} n'est disponible qu'avec un plan payant.` };
  }

  const { error } = await createServiceClient()
    .from("projects")
    .update({ [column]: parsed.data })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}`);
  return { success: `Webhook ${providerLabel} enregistré.` };
}

export async function disableDiscordWebhook(
  projectId: string,
  _prevState: ActionResult,
): Promise<ActionResult> {
  return disableChatWebhook("discord_webhook_url", "Discord", projectId);
}

export async function setDiscordWebhook(
  projectId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return setChatWebhook(
    "discord_webhook_url",
    "Discord",
    discordWebhookSchema,
    projectId,
    formData,
  );
}

export async function disableSlackWebhook(
  projectId: string,
  _prevState: ActionResult,
): Promise<ActionResult> {
  return disableChatWebhook("slack_webhook_url", "Slack", projectId);
}

export async function setSlackWebhook(
  projectId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return setChatWebhook(
    "slack_webhook_url",
    "Slack",
    slackWebhookSchema,
    projectId,
    formData,
  );
}

export async function disableTelegram(
  projectId: string,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!(await assertOwnsProject(supabase, projectId))) {
    return { error: "Projet introuvable." };
  }

  const { error } = await createServiceClient()
    .from("projects")
    .update({ telegram_bot_token: null, telegram_chat_id: null })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}`);
  return { success: "Telegram désactivé." };
}

export async function setTelegramConfig(
  projectId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const rawToken = formData.get("telegram_bot_token");
  const rawChatId = formData.get("telegram_chat_id");
  const hasToken = typeof rawToken === "string" && rawToken.trim() !== "";
  const hasChatId = typeof rawChatId === "string" && rawChatId.trim() !== "";

  // Same "empty means untouched" convention as setChatWebhook — the token
  // is never sent back to the browser, so an empty submit isn't "clear it".
  if (!hasToken && !hasChatId) {
    return { success: "Aucun changement." };
  }

  const update: Record<string, string> = {};

  if (hasToken) {
    const parsed = telegramTokenSchema.safeParse(rawToken);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Token invalide." };
    }
    update.telegram_bot_token = parsed.data;
  }

  // The chat ID is optional now: leave it blank and the bot fills it in
  // from the first /start it receives
  // (src/app/api/telegram/webhook/[projectId]). Still accepted when
  // someone already knows it, or wants to move the alerts to another chat.
  if (hasChatId) {
    const parsed = telegramChatIdSchema.safeParse(rawChatId);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Chat ID invalide." };
    }
    update.telegram_chat_id = parsed.data;
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { error: "Projet introuvable." };
  }

  const service = createServiceClient();
  const { data: ownerProfile } = await service
    .from("profiles")
    .select("plan")
    .eq("id", project.user_id)
    .single();

  if (!getPlanLimits((ownerProfile?.plan as Plan) ?? "free").chatWebhooks) {
    return { error: "Telegram n'est disponible qu'avec un plan payant." };
  }

  const { error } = await service.from("projects").update(update).eq("id", projectId);
  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}/integrations`);

  if (!hasToken) {
    return { success: "Chat Telegram enregistré." };
  }

  // A new token invalidates whatever webhook the old one had, and the bot
  // can't receive the /start that supplies the chat ID until this lands —
  // so it happens here rather than behind a separate button.
  const registered = await registerTelegramWebhook(
    service,
    projectId,
    update.telegram_bot_token,
  );
  if (!registered.ok) return { error: registered.reason };

  if (hasChatId) {
    return { success: "Telegram enregistré." };
  }

  return {
    success: "Token enregistré — envoyez maintenant /start à votre bot.",
  };
}

export async function toggleTarget(
  projectId: string,
  targetId: string,
  enabled: boolean,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const { error } = await (await createClient())
    .from("check_targets")
    .update({ enabled: !enabled })
    .eq("id", targetId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}`);
  return { success: enabled ? "URL désactivée." : "URL activée." };
}

export async function deleteTarget(
  projectId: string,
  targetId: string,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const { error } = await (await createClient())
    .from("check_targets")
    .delete()
    .eq("id", targetId)
    .eq("project_id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}`);
  revalidatePath("/app");
  return { success: "URL supprimée." };
}

// N5 (nav-pro backlog): hours <= 0 resumes alerts immediately. Owner-or-
// member, enforced by RLS's "update own or member projects" policy
// (migration 0022) — no separate ownership check needed here.
export async function silenceAlerts(
  projectId: string,
  hours: number,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  const alertsSilencedUntil =
    hours > 0 ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString() : null;

  const { error } = await supabase
    .from("projects")
    .update({ alerts_silenced_until: alertsSilencedUntil })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}/incidents`);
  return {
    success: alertsSilencedUntil
      ? `Alertes coupées pour ${hours}h.`
      : "Alertes reprises.",
  };
}

// D6 (drill-nav backlog): rules gated the same as chatWebhooks (Solo+,
// see docs/PLAN table) — reusing that flag rather than adding a
// same-shaped one, same shortcut already taken for GithubCheckCard's
// deployHooks gate above.
async function assertRulesAllowed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
): Promise<ActionResult | null> {
  const { data: project } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .single();

  if (!project) return { error: "Projet introuvable." };

  const { data: ownerProfile } = await createServiceClient()
    .from("profiles")
    .select("plan")
    .eq("id", project.user_id)
    .single();

  if (!getPlanLimits((ownerProfile?.plan as Plan) ?? "free").chatWebhooks) {
    return { error: "Les règles d'alerte ne sont disponibles qu'avec un plan payant." };
  }

  return null;
}

const confirmCountSchema = z.coerce.number().int().min(1).max(3);

export async function setAlertConfirmCount(
  projectId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = confirmCountSchema.safeParse(formData.get("alert_confirm_count"));
  if (!parsed.success) return { error: "Valeur invalide." };

  const supabase = await createClient();
  const denied = await assertRulesAllowed(supabase, projectId);
  if (denied) return denied;

  const { error } = await supabase
    .from("projects")
    .update({ alert_confirm_count: parsed.data })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}/settings`);
  return { success: "Règle enregistrée." };
}

const quietHourSchema = z.coerce.number().int().min(0).max(23);

export async function setQuietHours(
  projectId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const startRaw = formData.get("quiet_hours_start");
  const endRaw = formData.get("quiet_hours_end");

  const supabase = await createClient();
  const denied = await assertRulesAllowed(supabase, projectId);
  if (denied) return denied;

  // Either field left on "Désactivé" turns the whole window off — a
  // one-sided window (only a start, no end) isn't a valid schedule.
  let start: number | null = null;
  let end: number | null = null;
  if (startRaw && endRaw) {
    const parsedStart = quietHourSchema.safeParse(startRaw);
    const parsedEnd = quietHourSchema.safeParse(endRaw);
    if (!parsedStart.success || !parsedEnd.success) {
      return { error: "Heure invalide." };
    }
    start = parsedStart.data;
    end = parsedEnd.data;
  }

  const { error } = await supabase
    .from("projects")
    .update({ quiet_hours_start: start, quiet_hours_end: end })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}/settings`);
  revalidatePath(`/app/${projectId}/incidents`);
  return {
    success:
      start !== null
        ? `Heures calmes : ${start}h–${end}h.`
        : "Heures calmes désactivées.",
  };
}

// D6 (drill-nav backlog): per-URL silence — "Couper 4h" on /urls, and
// "Reprendre" from either /urls or /rules. hours <= 0 resumes immediately.
// Owner-or-member via RLS's "own or member targets" policy (migration
// 0022); silenced_until is a plain user-writable column (migration 0045).
export async function silenceTarget(
  projectId: string,
  targetId: string,
  hours: number,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  const silencedUntil =
    hours > 0 ? new Date(Date.now() + hours * 60 * 60 * 1000).toISOString() : null;

  const { error } = await supabase
    .from("check_targets")
    .update({ silenced_until: silencedUntil })
    .eq("id", targetId)
    .eq("project_id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}/urls`);
  revalidatePath(`/app/${projectId}/settings`);
  return {
    success: silencedUntil ? `URL coupée pour ${hours}h.` : "URL reprise.",
  };
}

// D8 (drill-nav backlog): signed outbound webhook — same Solo+ gate and
// Discord-style service-role write as the columns' own lockdown
// (migration 0047). The URL itself isn't a secret (unlike Discord/Slack
// webhook URLs, which embed a token), so it's shown back in the input
// directly rather than masked — only the HMAC secret gets the "shown
// once" treatment.
async function assertOutboundWebhookAllowed(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
): Promise<{ error: string } | { userId: string }> {
  const { data: project } = await supabase
    .from("projects")
    .select("user_id")
    .eq("id", projectId)
    .single();

  if (!project) return { error: "Projet introuvable." };

  const { data: ownerProfile } = await createServiceClient()
    .from("profiles")
    .select("plan")
    .eq("id", project.user_id)
    .single();

  if (!getPlanLimits((ownerProfile?.plan as Plan) ?? "free").chatWebhooks) {
    return { error: "Le webhook sortant n'est disponible qu'avec un plan payant." };
  }

  return { userId: project.user_id };
}

export async function setOutboundWebhookUrl(
  projectId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const raw = formData.get("outbound_webhook_url");
  const trimmed = typeof raw === "string" ? raw.trim() : "";

  // The input never carries the existing URL back to the browser (masked
  // placeholder instead, same convention as setChatWebhook above) — an
  // empty submit means "left untouched." disableOutboundWebhook below is
  // the explicit way to clear it.
  if (!trimmed) return { success: "Aucun changement." };

  const guard = await assertPublicHttpsUrl(trimmed);
  if (!guard.ok) return { error: guard.reason };

  const supabase = await createClient();
  const gate = await assertOutboundWebhookAllowed(supabase, projectId);
  if ("error" in gate) return gate;

  const { error } = await createServiceClient()
    .from("projects")
    .update({ outbound_webhook_url: trimmed })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}/integrations`);
  return { success: "URL du webhook enregistrée." };
}

export async function disableOutboundWebhook(
  projectId: string,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!(await assertOwnsProject(supabase, projectId))) {
    return { error: "Projet introuvable." };
  }

  const { error } = await createServiceClient()
    .from("projects")
    .update({ outbound_webhook_url: null, outbound_webhook_secret: null })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}/integrations`);
  return { success: "Webhook sortant désactivé." };
}

export type RegenerateSecretResult = ActionResult & { secret?: string };

export async function regenerateOutboundWebhookSecret(
  projectId: string,
  _prevState: RegenerateSecretResult,
): Promise<RegenerateSecretResult> {
  const supabase = await createClient();
  const gate = await assertOutboundWebhookAllowed(supabase, projectId);
  if ("error" in gate) return gate;

  const secret = randomBytes(32).toString("hex");

  const { error } = await createServiceClient()
    .from("projects")
    .update({ outbound_webhook_secret: secret })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}/integrations`);
  return {
    success: "Secret régénéré — copiez-le maintenant, il ne sera plus jamais affiché.",
    secret,
  };
}

export async function sendOutboundWebhookTest(
  projectId: string,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  const gate = await assertOutboundWebhookAllowed(supabase, projectId);
  if ("error" in gate) return gate;

  const service = createServiceClient();
  const { data: project } = await service
    .from("projects")
    .select("name, outbound_webhook_url, outbound_webhook_secret")
    .eq("id", projectId)
    .single();

  if (!project?.outbound_webhook_url || !project?.outbound_webhook_secret) {
    return { error: "Configurez d'abord l'URL et générez un secret." };
  }

  await sendOutboundWebhook(project.outbound_webhook_url, project.outbound_webhook_secret, {
    event: "fail",
    projectId,
    projectName: project.name,
    items: [{ url: "https://example.com", httpStatus: 500, missing: null }],
    test: true,
  });

  return { success: "Test envoyé." };
}
