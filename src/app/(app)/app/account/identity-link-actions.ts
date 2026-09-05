"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/db/server";
import type { ActionResult } from "@/lib/use-toast-action";

const PROVIDER_LABEL: Record<string, string> = {
  github: "GitHub",
  google: "Google",
  email: "Email",
};

// Detaching a sign-in method. The guard that matters is the last one: if
// this is the only way into the account, unlinking locks the user out for
// good. Supabase refuses a single remaining identity itself, but its error
// is opaque — and it counts the email identity, which is useless on its
// own when no password has ever been set.
export async function unlinkProvider(
  provider: string,
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Session expirée." };

  const { data, error: listError } = await supabase.auth.getUserIdentities();
  if (listError) return { error: listError.message };

  const identities = data?.identities ?? [];
  const target = identities.find((i) => i.provider === provider);
  if (!target) return { error: "Ce compte n'est pas lié." };

  if (identities.length <= 1) {
    return {
      error:
        "C'est votre seul moyen de connexion — définissez un mot de passe ou liez un autre compte avant de le retirer.",
    };
  }

  const { error } = await supabase.auth.unlinkIdentity(target);
  if (error) return { error: error.message };

  revalidatePath("/app/account");
  return { success: `${PROVIDER_LABEL[provider] ?? provider} délié.` };
}
