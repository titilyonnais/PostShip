"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { httpsUrlSchema } from "@/lib/validation";

const createProjectSchema = z.object({
  name: z.string().trim().min(1, "Le nom est requis.").max(120),
  base_url: httpsUrlSchema,
});

export type ProjectFormState = { error: string | null };

export async function createProject(
  _prevState: ProjectFormState,
  formData: FormData,
): Promise<ProjectFormState> {
  const parsed = createProjectSchema.safeParse({
    name: formData.get("name"),
    base_url: formData.get("base_url"),
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Formulaire invalide.",
    };
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
    name: parsed.data.name,
    base_url: parsed.data.base_url,
  });

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/app");
  return { error: null };
}

export async function renameProject(projectId: string, formData: FormData) {
  const parsed = z.string().trim().min(1).max(120).safeParse(formData.get("name"));

  if (!parsed.success) {
    redirect(`/app/${projectId}?error=${encodeURIComponent("Nom invalide.")}`);
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("projects")
    .update({ name: parsed.data })
    .eq("id", projectId);

  if (error) {
    redirect(`/app/${projectId}?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`/app/${projectId}`);
  revalidatePath("/app");
  redirect(
    `/app/${projectId}?success=${encodeURIComponent("Nom mis à jour.")}`,
  );
}

export async function deleteProject(projectId: string) {
  const supabase = await createClient();
  await supabase.from("projects").delete().eq("id", projectId);
  revalidatePath("/app");
  redirect(`/app?success=${encodeURIComponent("Projet supprimé.")}`);
}
