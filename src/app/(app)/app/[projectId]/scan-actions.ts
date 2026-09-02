"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { createSiteScan } from "@/lib/scan";
import type { ActionResult } from "@/lib/use-toast-action";
import { assertRegisterableHttpsUrl } from "@/lib/validation";

export async function startSiteScan(
  projectId: string,
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const raw = formData.get("seed_url");
  const urlCheck = await assertRegisterableHttpsUrl(
    typeof raw === "string" ? raw : "",
  );
  if (!urlCheck.ok) {
    return { error: urlCheck.reason };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const result = await createSiteScan({
    userId: user.id,
    projectId,
    seedUrl: urlCheck.url,
  });

  if ("error" in result) return { error: result.error };

  revalidatePath(`/app/${projectId}`);
  revalidatePath(`/app/${projectId}/scans`);
  return {
    success: "Scan lancé — les résultats arrivent progressivement.",
  };
}
