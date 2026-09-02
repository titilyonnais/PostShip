"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { createServiceClient } from "@/lib/db/service";
import { generateVerificationToken, verifyDomainOwnership } from "@/lib/domain-verify";
import type { ActionResult } from "@/lib/use-toast-action";

// Project access (owner or accepted collaborator) is enforced by RLS on
// this select itself — a project the caller can't see returns null here,
// same as the pattern in [projectId]/actions.ts's assertOwnsProject.
async function getProjectHost(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
): Promise<string | null> {
  const { data: project } = await supabase
    .from("projects")
    .select("base_url")
    .eq("id", projectId)
    .single();

  if (!project) return null;

  try {
    return new URL(project.base_url).hostname;
  } catch {
    return null;
  }
}

export async function rotateDomainToken(
  projectId: string,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const host = await getProjectHost(supabase, projectId);
  if (!host) return { error: "Projet introuvable." };

  const { error } = await createServiceClient()
    .from("domain_verifications")
    .upsert(
      {
        project_id: projectId,
        host,
        token: generateVerificationToken(),
        verified_at: null,
        method: null,
      },
      { onConflict: "project_id,host" },
    );

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}/settings`);
  return { success: "Nouveau token généré — mettez à jour votre TXT ou fichier well-known." };
}

export async function verifyProjectDomain(
  projectId: string,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const host = await getProjectHost(supabase, projectId);
  if (!host) return { error: "Projet introuvable." };

  const service = createServiceClient();
  const { data: existing } = await service
    .from("domain_verifications")
    .select("token")
    .eq("project_id", projectId)
    .eq("host", host)
    .maybeSingle();

  const token = existing?.token ?? generateVerificationToken();
  const result = await verifyDomainOwnership(host, token);

  const { error } = await service.from("domain_verifications").upsert(
    {
      project_id: projectId,
      host,
      token,
      verified_at: result.verified ? new Date().toISOString() : null,
      method: result.verified ? result.method : null,
    },
    { onConflict: "project_id,host" },
  );

  if (error) return { error: error.message };
  if (!result.verified) return { error: result.reason };

  revalidatePath(`/app/${projectId}/settings`);
  return { success: "Domaine vérifié — les vérifications automatiques peuvent démarrer." };
}
