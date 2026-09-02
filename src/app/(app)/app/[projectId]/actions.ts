"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { runOneTarget, runProjectChecks } from "@/lib/runner";
import { createServiceClient } from "@/lib/db/service";
import { assertPublicHttpsUrl } from "@/lib/ssrf";
import type { ActionResult } from "@/lib/use-toast-action";
import { httpsUrlSchema } from "@/lib/validation";

// discord_webhook_url and vercel_hook_secret are service-role-only columns
// (see migration 0017) — the "own projects" RLS policy is `for all`, so
// leaving them user-writable would let a direct PostgREST call bypass the
// Discord-domain regex and plan gating below (discord_webhook_url is
// fetched directly by src/lib/alerts.ts, making a bypassed value a stored
// SSRF target). Every write to these two columns must go through this
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

const TARGET_KINDS = ["http", "og", "sitemap", "ssl", "stripe_health"] as const;
const RUN_NOW_COOLDOWN_MS = 30_000;
const TARGET_COOLDOWN_MS = 10_000;

const addTargetSchema = z.object({
  url: httpsUrlSchema,
  kind: z.enum(TARGET_KINDS).default("http"),
});

export type TargetFormState = { error: string | null };

export async function addTarget(
  projectId: string,
  _prevState: TargetFormState,
  formData: FormData,
): Promise<TargetFormState> {
  const parsed = addTargetSchema.safeParse({
    url: formData.get("url"),
    kind: formData.get("kind") || undefined,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "URL invalide.",
    };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .single();

  if (!project) {
    return { error: "Projet introuvable." };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  // RLS scopes this count to the current user's own targets across all projects.
  const { count } = await supabase
    .from("check_targets")
    .select("id", { count: "exact", head: true });

  const limits = getPlanLimits((profile?.plan as Plan) ?? "free");

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

  const guard = await assertPublicHttpsUrl(parsed.data.url);
  if (!guard.ok) {
    return { error: guard.reason };
  }

  const { error } = await supabase.from("check_targets").insert({
    project_id: projectId,
    url: parsed.data.url,
    kind: parsed.data.kind,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath(`/app/${projectId}`);
  return { error: null };
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

export async function setVercelHookSecret(
  projectId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = z
    .string()
    .trim()
    .min(1, "Secret invalide.")
    .safeParse(formData.get("vercel_hook_secret"));

  if (!parsed.success) return { error: "Secret invalide." };

  const supabase = await createClient();
  if (!(await assertOwnsProject(supabase, projectId))) {
    return { error: "Projet introuvable." };
  }

  const { error } = await createServiceClient()
    .from("projects")
    .update({ vercel_hook_secret: parsed.data })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}`);
  return { success: "Secret Vercel enregistré." };
}

export async function disableDiscordWebhook(
  projectId: string,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  if (!(await assertOwnsProject(supabase, projectId))) {
    return { error: "Projet introuvable." };
  }

  const { error } = await createServiceClient()
    .from("projects")
    .update({ discord_webhook_url: null })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}`);
  return { success: "Webhook Discord désactivé." };
}

export async function setDiscordWebhook(
  projectId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const raw = formData.get("discord_webhook_url");

  // The input never carries the existing URL back to the browser (see the
  // settings page — it's shown as a masked placeholder instead), so an
  // empty submit here means "left untouched," not "clear it." Disabling
  // has its own explicit action/button.
  if (raw === "" || raw === null) {
    return { success: "Aucun changement." };
  }

  const parsed = discordWebhookSchema.safeParse(raw);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "URL invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan")
    .eq("id", user.id)
    .single();

  if (!getPlanLimits((profile?.plan as Plan) ?? "free").discord) {
    return { error: "Discord n'est disponible qu'avec un plan payant." };
  }

  if (!(await assertOwnsProject(supabase, projectId))) {
    return { error: "Projet introuvable." };
  }

  const { error } = await createServiceClient()
    .from("projects")
    .update({ discord_webhook_url: parsed.data })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}`);
  return { success: "Webhook Discord enregistré." };
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
