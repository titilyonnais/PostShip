"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { httpsUrlSchema } from "@/lib/validation";

const TARGET_KINDS = ["http", "og", "sitemap", "ssl", "stripe_health"] as const;

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
