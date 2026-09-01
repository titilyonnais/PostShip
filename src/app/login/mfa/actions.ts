"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";

export type MfaChallengeState = { error: string | null };

export async function verifyMfaChallenge(
  factorId: string,
  _prevState: MfaChallengeState,
  formData: FormData,
): Promise<MfaChallengeState> {
  const code = String(formData.get("code") ?? "").trim();
  if (!/^\d{6}$/.test(code)) {
    return { error: "Code à 6 chiffres requis." };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.mfa.challengeAndVerify({
    factorId,
    code,
  });

  if (error) {
    return { error: "Code invalide ou expiré." };
  }

  redirect("/app");
}
