"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { createServiceClient } from "@/lib/db/service";
import { getStripe } from "@/lib/stripe";

function fail(message: string, tab?: string): never {
  const tabParam = tab ? `&tab=${tab}` : "";
  redirect(`/app/account?error=${encodeURIComponent(message)}${tabParam}`);
}

function ok(message: string, tab?: string): never {
  const tabParam = tab ? `&tab=${tab}` : "";
  redirect(`/app/account?success=${encodeURIComponent(message)}${tabParam}`);
}

export async function updateDisplayName(formData: FormData) {
  const parsed = z
    .string()
    .trim()
    .max(120)
    .safeParse(formData.get("display_name"));

  if (!parsed.success) fail("Nom invalide.", "profile");

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
  ok("Nom enregistré.", "profile");
}

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Le nom complet est requis.").max(120),
  company_name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  team_size: z.enum(["solo", "2-5", "6-20", "20+"]).optional(),
});

export async function updateProfile(formData: FormData) {
  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    company_name: formData.get("company_name") || undefined,
    phone: formData.get("phone") || undefined,
    team_size: formData.get("team_size") || undefined,
  });

  if (!parsed.success) {
    fail(parsed.error.issues[0]?.message ?? "Formulaire invalide.", "profile");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await supabase
    .from("profiles")
    .update({
      full_name: parsed.data.full_name,
      company_name: parsed.data.company_name || null,
      phone: parsed.data.phone || null,
      team_size: parsed.data.team_size || null,
    })
    .eq("id", user.id);

  revalidatePath("/app/account");
  ok("Profil mis à jour.", "profile");
}

const billingAddressSchema = z.object({
  line1: z.string().trim().min(1, "L'adresse est requise.").max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1, "La ville est requise.").max(120),
  postal_code: z.string().trim().min(1, "Le code postal est requis.").max(20),
  country: z.string().trim().length(2, "Code pays ISO à 2 lettres.").max(2),
});

export async function updateBillingAddress(formData: FormData) {
  const parsed = billingAddressSchema.safeParse({
    line1: formData.get("line1"),
    line2: formData.get("line2") || undefined,
    city: formData.get("city"),
    postal_code: formData.get("postal_code"),
    country: formData.get("country"),
  });

  if (!parsed.success) {
    fail(parsed.error.issues[0]?.message ?? "Adresse invalide.", "billing");
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const billingAddress = {
    line1: parsed.data.line1,
    line2: parsed.data.line2 || null,
    city: parsed.data.city,
    postal_code: parsed.data.postal_code,
    country: parsed.data.country.toUpperCase(),
  };

  const { data: profile } = await supabase
    .from("profiles")
    .update({ billing_address: billingAddress })
    .eq("id", user.id)
    .select("stripe_customer_id, full_name")
    .single();

  if (profile?.stripe_customer_id) {
    try {
      await getStripe().customers.update(profile.stripe_customer_id, {
        name: profile.full_name ?? undefined,
        address: {
          line1: billingAddress.line1,
          line2: billingAddress.line2 ?? undefined,
          city: billingAddress.city,
          postal_code: billingAddress.postal_code,
          country: billingAddress.country,
        },
      });
    } catch {
      // Stripe sync is best-effort here — the address is already saved in
      // profiles either way, and the next invoice will re-read from Stripe.
    }
  }

  revalidatePath("/app/account");
  ok("Adresse de facturation mise à jour.", "billing");
}

const notificationPrefsSchema = z.object({
  email_alerts_enabled: z.boolean(),
  locale: z.enum(["fr", "en"]),
});

export async function updateNotificationPrefs(formData: FormData) {
  const parsed = notificationPrefsSchema.safeParse({
    email_alerts_enabled: formData.get("email_alerts_enabled") === "on",
    locale: formData.get("locale"),
  });

  if (!parsed.success) fail("Préférences invalides.", "notifications");

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await supabase
    .from("profiles")
    .update({
      email_alerts_enabled: parsed.data.email_alerts_enabled,
      locale: parsed.data.locale,
    })
    .eq("id", user.id);

  revalidatePath("/app/account");
  ok("Préférences enregistrées.", "notifications");
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

  if (error) fail(error.message, "danger");

  redirect("/?deleted=1");
}
