"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import type { ActionResult } from "@/lib/use-toast-action";
import { assertRegisterableHttpsUrl } from "@/lib/validation";

const createProjectNameSchema = z
  .string()
  .trim()
  .min(1, "Le nom est requis.")
  .max(120);

export type ProjectFormState = { error: string | null };

export async function createProject(
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const nameParsed = createProjectNameSchema.safeParse(formData.get("name"));
  if (!nameParsed.success) {
    return {
      error: nameParsed.error.issues[0]?.message ?? "Formulaire invalide.",
    };
  }

  const rawBaseUrl = formData.get("base_url");
  const urlCheck = await assertRegisterableHttpsUrl(
    typeof rawBaseUrl === "string" ? rawBaseUrl : "",
  );
  if (!urlCheck.ok) {
    return { error: urlCheck.reason };
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

  const { count } = await supabase
    .from("projects")
    .select("id", { count: "exact", head: true });

  const limits = getPlanLimits((profile?.plan as Plan) ?? "free");

  if ((count ?? 0) >= limits.projects) {
    return {
      error: `Limite de ${limits.projects} projet(s) atteinte pour votre plan.`,
    };
  }

  const { error } = await supabase.from("projects").insert({
    user_id: user.id,
    name: nameParsed.data,
    base_url: urlCheck.url,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/app");
  return { error: null };
}

export async function renameProject(
  projectId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = z.string().trim().min(1).max(120).safeParse(formData.get("name"));

  if (!parsed.success) return { error: "Nom invalide." };

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ name: parsed.data })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}`);
  revalidatePath("/app");
  return { success: "Nom mis à jour." };
}

export async function updateProjectBaseUrl(
  projectId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const raw = formData.get("base_url");
  const urlCheck = await assertRegisterableHttpsUrl(
    typeof raw === "string" ? raw : "",
  );

  if (!urlCheck.ok) {
    return { error: urlCheck.reason };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ base_url: urlCheck.url })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}`);
  revalidatePath("/app");
  return { success: "URL de base mise à jour." };
}

export async function toggleProjectPause(
  projectId: string,
  paused: boolean,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ paused: !paused })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}`);
  revalidatePath("/app");
  return {
    success: paused
      ? "Projet réactivé — les vérifications automatiques reprennent."
      : "Mode maintenance activé — vérifications automatiques et alertes suspendues.",
  };
}

export async function updateStripeSuccessUrl(
  projectId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const raw = formData.get("stripe_success_url");
  const trimmed = typeof raw === "string" ? raw.trim() : "";

  // Empty clears the override — stripe_health targets then fall back to
  // their own configured URL (see runner.ts).
  let value: string | null = null;
  if (trimmed) {
    const urlCheck = await assertRegisterableHttpsUrl(trimmed);
    if (!urlCheck.ok) return { error: urlCheck.reason };
    value = urlCheck.url;
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ stripe_success_url: value })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}/settings`);
  return {
    success: value
      ? "URL de succès Stripe mise à jour."
      : "URL de succès Stripe retirée — les checks Stripe utiliseront l'URL de leur propre cible.",
  };
}

export async function toggleCheckPreviews(
  projectId: string,
  checkPreviews: boolean,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ check_previews: !checkPreviews })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}/settings`);
  return {
    success: checkPreviews
      ? "Vérification des previews désactivée."
      : "Vérification des previews activée — un déploiement de preview Vercel déclenchera aussi des checks.",
  };
}

export async function toggleBadgePublic(
  projectId: string,
  badgePublic: boolean,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ badge_public: !badgePublic })
    .eq("id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}/settings`);
  return {
    success: badgePublic
      ? "Badge public désactivé."
      : "Badge public activé — /badge/" + projectId + " est maintenant accessible.",
  };
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient();
  await supabase.from("projects").delete().eq("id", projectId);
  revalidatePath("/app");
  redirect(`/app?success=${encodeURIComponent("Projet supprimé.")}`);
}
