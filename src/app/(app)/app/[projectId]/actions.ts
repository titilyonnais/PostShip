"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { runOneTarget, runProjectChecks } from "@/lib/runner";
import { httpsUrlSchema } from "@/lib/validation";

const discordWebhookSchema = z
  .string()
  .trim()
  .regex(
    /^https:\/\/(discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+$/,
    "URL de webhook Discord invalide.",
  );

const TARGET_KINDS = ["http", "og", "sitemap", "ssl", "stripe_health"] as const;
const RUN_NOW_COOLDOWN_MS = 30_000;

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

export async function runProjectNow(projectId: string) {
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

  if (!project) {
    redirect(
      `/app/${projectId}?error=${encodeURIComponent("Projet introuvable.")}`,
    );
  }

  if (project.last_checked_at) {
    const elapsedMs = Date.now() - new Date(project.last_checked_at).getTime();
    if (elapsedMs < RUN_NOW_COOLDOWN_MS) {
      const waitSeconds = Math.ceil((RUN_NOW_COOLDOWN_MS - elapsedMs) / 1000);
      redirect(
        `/app/${projectId}?error=${encodeURIComponent(`Patientez ${waitSeconds}s avant de relancer.`)}`,
      );
    }
  }

  let results: Awaited<ReturnType<typeof runProjectChecks>>;
  try {
    results = await runProjectChecks(projectId);
  } catch (err) {
    redirect(
      `/app/${projectId}?error=${encodeURIComponent(
        err instanceof Error ? err.message : "Erreur pendant l'exécution.",
      )}`,
    );
  }

  revalidatePath("/app");

  if (results.length === 0) {
    redirect(
      `/app/${projectId}?success=${encodeURIComponent("Vérification lancée — aucune URL active à tester.")}`,
    );
  }

  const passed = results.filter((r) => r.outcome === "pass").length;
  const failed = results.length - passed;
  redirect(
    `/app/${projectId}?success=${encodeURIComponent(
      `Vérification terminée : ${passed}/${results.length} OK` +
        (failed > 0 ? `, ${failed} en échec.` : "."),
    )}`,
  );
}

const TARGET_COOLDOWN_MS = 10_000;

export async function runTargetNow(projectId: string, targetId: string) {
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

  if (!target) {
    redirect(
      `/app/${projectId}?error=${encodeURIComponent("URL introuvable.")}`,
    );
  }

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
      redirect(
        `/app/${projectId}?error=${encodeURIComponent(`Patientez ${waitSeconds}s avant de relancer cette URL.`)}`,
      );
    }
  }

  let result: Awaited<ReturnType<typeof runOneTarget>>;
  try {
    result = await runOneTarget(targetId);
  } catch (err) {
    redirect(
      `/app/${projectId}?error=${encodeURIComponent(
        err instanceof Error ? err.message : "Erreur pendant l'exécution.",
      )}`,
    );
  }

  revalidatePath(`/app/${projectId}`);
  revalidatePath("/app");
  redirect(
    `/app/${projectId}?success=${encodeURIComponent(
      result.outcome === "pass"
        ? `OK — ${target.url}`
        : `Échec détecté — ${target.url}`,
    )}`,
  );
}

export async function setVercelHookSecret(
  projectId: string,
  formData: FormData,
) {
  const parsed = z
    .string()
    .trim()
    .min(1, "Secret invalide.")
    .safeParse(formData.get("vercel_hook_secret"));

  if (!parsed.success) {
    redirect(
      `/app/${projectId}?tab=settings&error=${encodeURIComponent("Secret invalide.")}`,
    );
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ vercel_hook_secret: parsed.data })
    .eq("id", projectId);

  if (error) {
    redirect(
      `/app/${projectId}?tab=settings&error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/app/${projectId}`);
  redirect(
    `/app/${projectId}?tab=settings&success=${encodeURIComponent("Secret Vercel enregistré.")}`,
  );
}

export async function setDiscordWebhook(projectId: string, formData: FormData) {
  const raw = formData.get("discord_webhook_url");

  if (raw === "" || raw === null) {
    const supabase = await createClient();
    await supabase
      .from("projects")
      .update({ discord_webhook_url: null })
      .eq("id", projectId);
    revalidatePath(`/app/${projectId}`);
    redirect(
      `/app/${projectId}?tab=settings&success=${encodeURIComponent("Webhook Discord désactivé.")}`,
    );
  }

  const parsed = discordWebhookSchema.safeParse(raw);
  if (!parsed.success) {
    redirect(
      `/app/${projectId}?tab=settings&error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "URL invalide.")}`,
    );
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
    redirect(
      `/app/${projectId}?tab=settings&error=${encodeURIComponent("Discord n'est disponible qu'avec un plan payant.")}`,
    );
  }

  const { error } = await supabase
    .from("projects")
    .update({ discord_webhook_url: parsed.data })
    .eq("id", projectId);

  if (error) {
    redirect(
      `/app/${projectId}?tab=settings&error=${encodeURIComponent(error.message)}`,
    );
  }

  revalidatePath(`/app/${projectId}`);
  redirect(
    `/app/${projectId}?tab=settings&success=${encodeURIComponent("Webhook Discord enregistré.")}`,
  );
}

export async function toggleTarget(
  projectId: string,
  targetId: string,
  enabled: boolean,
) {
  const supabase = await createClient();
  await supabase
    .from("check_targets")
    .update({ enabled: !enabled })
    .eq("id", targetId);

  revalidatePath(`/app/${projectId}`);
}
