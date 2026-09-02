"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { createServiceClient } from "@/lib/db/service";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { sendProjectInviteEmail } from "@/lib/project-members";
import type { ActionResult } from "@/lib/use-toast-action";

// Stricter than the assertOwnsProject helper in actions.ts (which also
// admits accepted collaborators, by design, for the rest of the settings
// page) — inviting or removing collaborators is deliberately owner-only,
// so a collaborator can never grant themselves or someone else that same
// access.
async function assertIsProjectOwner(
  supabase: Awaited<ReturnType<typeof createClient>>,
  projectId: string,
  userId: string,
): Promise<boolean> {
  const { data } = await supabase
    .from("projects")
    .select("id")
    .eq("id", projectId)
    .eq("user_id", userId)
    .maybeSingle();
  return !!data;
}

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Adresse email invalide."),
});

export async function inviteProjectMember(
  projectId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = inviteSchema.safeParse({ email: formData.get("email") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Email invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, email")
    .eq("id", user.id)
    .single();

  if (!getPlanLimits((profile?.plan as Plan) ?? "free").teamMembers) {
    return { error: "Les collaborateurs ne sont disponibles qu'avec le plan Team." };
  }

  if (!(await assertIsProjectOwner(supabase, projectId, user.id))) {
    return { error: "Projet introuvable." };
  }

  if (parsed.data.email === (profile?.email ?? "").toLowerCase()) {
    return { error: "Vous ne pouvez pas vous inviter vous-même." };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("id", projectId)
    .single();

  const service = createServiceClient();

  // A profile matching this email may already exist — if so, attach the
  // membership immediately (they can access the project the moment they
  // next log in) instead of waiting on the pending->accepted linking that
  // only fires at signup time (src/lib/project-members.ts).
  const { data: existingProfile } = await service
    .from("profiles")
    .select("id")
    .ilike("email", parsed.data.email)
    .maybeSingle();

  const { error } = await service.from("project_members").upsert(
    {
      project_id: projectId,
      invited_email: parsed.data.email,
      invited_by: user.id,
      user_id: existingProfile?.id ?? null,
      status: existingProfile ? "accepted" : "pending",
      accepted_at: existingProfile ? new Date().toISOString() : null,
    },
    { onConflict: "project_id,invited_email" },
  );

  if (error) return { error: error.message };

  try {
    await sendProjectInviteEmail({
      to: parsed.data.email,
      projectName: project?.name ?? "un projet PostShip",
      inviterEmail: profile?.email ?? "Un collaborateur",
      hasAccount: !!existingProfile,
    });
  } catch (err) {
    console.error("Échec envoi email d'invitation", err);
  }

  revalidatePath(`/app/${projectId}/settings`);
  return { success: `Invitation envoyée à ${parsed.data.email}.` };
}

export async function removeProjectMember(
  projectId: string,
  memberId: string,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  if (!(await assertIsProjectOwner(supabase, projectId, user.id))) {
    return { error: "Projet introuvable." };
  }

  const { error } = await createServiceClient()
    .from("project_members")
    .delete()
    .eq("id", memberId)
    .eq("project_id", projectId);

  if (error) return { error: error.message };

  revalidatePath(`/app/${projectId}/settings`);
  return { success: "Collaborateur retiré." };
}

export async function leaveProject(
  projectId: string,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Uses the user's own session client, scoped by the "read own
  // memberships" RLS policy — deleting their own row doesn't need the
  // owner check above, but does need a policy allowing it, which
  // project_members doesn't grant to `authenticated` at all (see migration
  // 0022), so this goes through the service role after confirming the row
  // actually belongs to this user.
  const { data: membership } = await supabase
    .from("project_members")
    .select("id")
    .eq("project_id", projectId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (!membership) return { error: "Vous n'êtes pas collaborateur de ce projet." };

  const { error } = await createServiceClient()
    .from("project_members")
    .delete()
    .eq("id", membership.id);

  if (error) return { error: error.message };

  redirect("/app?success=" + encodeURIComponent("Vous avez quitté le projet."));
}
