"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "@/lib/legal";

export async function acceptTerms(formData: FormData) {
  if (formData.get("terms_accepted") !== "on") {
    redirect(
      `/accept-terms?error=${encodeURIComponent(
        "Vous devez accepter les CGU et la politique de confidentialité pour continuer.",
      )}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // The user's own session client is enough here — they're already
  // authenticated, no service role needed (unlike signUpWithPassword,
  // which may run before a session exists).
  await supabase
    .from("profiles")
    .update({
      terms_accepted_at: new Date().toISOString(),
      terms_version: CURRENT_TERMS_VERSION,
      privacy_version: CURRENT_PRIVACY_VERSION,
    })
    .eq("id", user.id);

  redirect("/app");
}
