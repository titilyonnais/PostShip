"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auditLog, getAdminSession } from "@/lib/admin-auth";
import { runRiskSweep } from "@/lib/admin-risk-sweep";

export type SweepState = { error?: string; success?: string };

// The list reads the score the nightly sweep stored, which means a new
// account reads "non évalué" until the next night — right when someone is
// most likely to be looking at it. This runs the same sweep on demand.
export async function rescoreAccounts(_prev: SweepState): Promise<SweepState> {
  const session = await getAdminSession();
  if (!session) redirect("/admin/login");

  try {
    const result = await runRiskSweep();
    await auditLog({
      accountId: session.accountId,
      username: session.username,
      action: "risk.sweep_manual",
      detail: result,
    });

    revalidatePath("/admin/users");
    return {
      success: `${result.scanned} compte(s) évalué(s), ${result.flagged} signalé(s), score max ${result.topScore}.`,
    };
  } catch (err) {
    return { error: err instanceof Error ? err.message : "Échec du balayage." };
  }
}
