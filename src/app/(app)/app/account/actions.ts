"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { createServiceClient } from "@/lib/db/service";
import { getStripe } from "@/lib/stripe";

export async function updateDisplayName(formData: FormData) {
  const parsed = z
    .string()
    .trim()
    .max(120)
    .safeParse(formData.get("display_name"));

  if (!parsed.success) {
    redirect(
      `/app/account?error=${encodeURIComponent("Nom invalide.")}`,
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await supabase
    .from("profiles")
    .update({ display_name: parsed.data || null })
    .eq("id", user.id);

  revalidatePath("/app/account");
}

export async function deleteAccount() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_subscription_id")
    .eq("id", user.id)
    .single();

  if (profile?.stripe_subscription_id) {
    try {
      await getStripe().subscriptions.cancel(profile.stripe_subscription_id);
    } catch {
      // Already canceled/missing on Stripe's side — proceed with deletion
      // regardless, the account is going away either way.
    }
  }

  // profiles -> projects -> check_targets -> check_runs/alert_events all
  // cascade on delete (see supabase/migrations), so deleting the auth user
  // is enough to remove everything.
  const service = createServiceClient();
  const { error } = await service.auth.admin.deleteUser(user.id);

  if (error) {
    redirect(`/app/account?error=${encodeURIComponent(error.message)}`);
  }

  redirect("/?deleted=1");
}
