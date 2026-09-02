"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { applyMoneyPath } from "@/lib/money-path";
import { runOneTarget, runProjectChecks } from "@/lib/runner";
import { createServiceClient } from "@/lib/db/service";
import type { ActionResult } from "@/lib/use-toast-action";
import { assertRegisterableHttpsUrl } from "@/lib/validation";

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

const discordWebhookSchema = z
  .string()
  .trim()
  .regex(
    /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/,
    "URL de webhook Discord invalide.",
  );

const slackWebhookSchema = z
  .string()
  .trim()
  .regex(
    /^https:\/\/hooks\.slack\.com\/services\/[\w-]+\/[\w-]+\/[\w-]+$/,
    "URL de webhook Slack invalide.",
  );

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id, user_id")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { error: "Projet introuvable." };
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

  const { error } = await supabase.from("check_targets").insert({
    project_id: projectId,
    url: urlCheck.url,
    kind: parsed.data.kind,
    expect_status: parsed.data.expect_status,
    expect_contains: parsed.data.expect_contains,
    expect_not_contains: parsed.data.expect_not_contains,
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
  return {
    success:
      result.outcome === "pass"
        ? `OK — ${target.url}`
        : `Échec détecté — ${target.url}`,
  };
}

async function setDeployHookSecret(
  column: "vercel_hook_secret" | "netlify_hook_secret" | "cloudflare_hook_secret",
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

export async function setVercelHookSecret(
  projectId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return setDeployHookSecret("vercel_hook_secret", "Vercel", projectId, formData);
}

export async function setNetlifyHookSecret(
  projectId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  return setDeployHookSecret("netlify_hook_secret", "Netlify", projectId, formData);
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

  // Same "empty means untouched" convention as setChatWebhook — the token
  // is never sent back to the browser, so an empty submit isn't "clear it".
  if ((rawToken === "" || rawToken === null) && (rawChatId === "" || rawChatId === null)) {
    return { success: "Aucun changement." };
  }

  const parsedToken = telegramTokenSchema.safeParse(rawToken);
  if (!parsedToken.success) {
    return { error: parsedToken.error.issues[0]?.message ?? "Token invalide." };
  }
  const parsedChatId = telegramChatIdSchema.safeParse(rawChatId);
  if (!parsedChatId.success) {
    return { error: parsedChatId.error.issues[0]?.message ?? "Chat ID invalide." };
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

  const { data: ownerProfile } = await createServiceClient()
    .from("profiles")
    .select("plan")
    .eq("id", project.user_id)
    .single();

  if (!getPlanLimits((ownerProfile?.plan as Plan) ?? "free").chatWebhooks) {
    return { error: "Telegram n'est disponible qu'avec un plan payant." };
  }

  const { error } = await createServiceClient()
    .from("projects")
    .update({
      telegram_bot_token: parsedToken.data,
      telegram_chat_id: parsedChatId.data,
    })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}`);
  return { success: "Telegram enregistré." };
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
