"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditLog, getAdminSession, requestContext } from "@/lib/admin-auth";
import { createServiceClient } from "@/lib/db/service";
import { recordOpsEvent } from "@/lib/ops-events";

export type ProjectActionState = { error?: string; success?: string };

// The only write this console makes against a customer project. No
// deletion — a project is someone's monitoring setup and a misclick would
// be unrecoverable — and no editing of the integration secrets, which the
// console has no business reading in the first place.
export async function toggleProjectPause(
  projectId: string,
  paused: boolean,
  _prev: ProjectActionState,
): Promise<ProjectActionState> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  const next = !paused;
  const { error } = await createServiceClient()
    .from("projects")
    .update({ paused: next })
    .eq("id", projectId);

  if (error) return { error: error.message };

  const { ip, userAgent } = await requestContext();
  const action = next ? "project.paused" : "project.resumed";

  await auditLog({
    accountId: session.accountId,
    username: session.username,
    action,
    target: projectId,
  });
  await recordOpsEvent({
    source: "console",
    severity: "warn",
    action,
    actorAdminId: session.accountId,
    target: projectId,
    ip,
    userAgent,
  });

  revalidatePath(`/admin/projects/${projectId}`);
  return { success: next ? "Projet mis en pause." : "Projet relancé." };
}
