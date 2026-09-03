"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { findAccountProvidersByEmail } from "@/lib/auth-admin";
import { createClient } from "@/lib/db/server";
import { createServiceClient } from "@/lib/db/service";
import { getStripe } from "@/lib/stripe";
import type { ActionResult } from "@/lib/use-toast-action";

export async function updateDisplayName(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = z
    .string()
    .trim()
    .max(120)
    .safeParse(formData.get("display_name"));

  if (!parsed.success) return { error: "Nom invalide." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await supabase
    .from("profiles")
    .update({ display_name: parsed.data || null })
    .eq("id", user.id);

  return { success: "Nom enregistré." };
}

const profileSchema = z.object({
  full_name: z.string().trim().min(1, "Le nom complet est requis.").max(120),
  company_name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  team_size: z.enum(["solo", "2-5", "6-20", "20+"]).optional(),
});

export async function updateProfile(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = profileSchema.safeParse({
    full_name: formData.get("full_name"),
    company_name: formData.get("company_name") || undefined,
    phone: formData.get("phone") || undefined,
    team_size: formData.get("team_size") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
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

  return { success: "Profil mis à jour." };
}

const billingAddressSchema = z.object({
  line1: z.string().trim().min(1, "L'adresse est requise.").max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1, "La ville est requise.").max(120),
  postal_code: z.string().trim().min(1, "Le code postal est requis.").max(20),
  country: z.string().trim().length(2, "Code pays ISO à 2 lettres.").max(2),
});

export async function updateBillingAddress(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = billingAddressSchema.safeParse({
    line1: formData.get("line1"),
    line2: formData.get("line2") || undefined,
    city: formData.get("city"),
    postal_code: formData.get("postal_code"),
    country: formData.get("country"),
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Adresse invalide." };
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

  return { success: "Adresse de facturation mise à jour." };
}

const notificationPrefsSchema = z.object({
  email_alerts_enabled: z.boolean(),
  locale: z.enum(["fr", "en"]),
});

export async function updateNotificationPrefs(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = notificationPrefsSchema.safeParse({
    email_alerts_enabled: formData.get("email_alerts_enabled") === "on",
    locale: formData.get("locale"),
  });

  if (!parsed.success) return { error: "Préférences invalides." };

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

  return { success: "Préférences enregistrées." };
}

const usernameSchema = z
  .string()
  .trim()
  .min(3, "3 caractères minimum.")
  .max(24, "24 caractères maximum.")
  .regex(/^[a-zA-Z0-9_-]+$/, "Lettres, chiffres, - et _ uniquement.");

export async function updateIdentity(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = usernameSchema.safeParse(formData.get("username"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Pseudo invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase
    .from("profiles")
    .update({ username: parsed.data })
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") return { error: "Ce pseudo est déjà pris." };
    return { error: error.message };
  }

  return { success: "Pseudo mis à jour." };
}

export async function regenerateAvatar(
  _prevState: ActionResult,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await supabase
    .from("profiles")
    // Also clears any uploaded photo — "Nouvel avatar" should switch back
    // to a generated one, not silently no-op while a real photo is set
    // (resolveAvatarUrl prefers avatar_url whenever it's present).
    .update({ avatar_seed: crypto.randomUUID(), avatar_url: null })
    .eq("id", user.id);

  return { success: "Nouvel avatar généré." };
}

const AVATAR_MAX_BYTES = 2 * 1024 * 1024;
const AVATAR_MIME_EXT: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

export async function uploadAvatarPhoto(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choisissez une image." };
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { error: "Image trop lourde (2 Mo max)." };
  }
  const ext = AVATAR_MIME_EXT[file.type];
  if (!ext) {
    return { error: "Format non pris en charge (PNG, JPEG ou WebP)." };
  }

  // One fixed key per user, overwritten on every upload — no orphaned
  // files to clean up, and the bucket's own RLS (see migration 0052)
  // only lets a user write under their own uid prefix.
  const path = `${user.id}/avatar.${ext}`;
  const { error: uploadError } = await supabase.storage
    .from("avatars")
    .upload(path, file, { upsert: true, contentType: file.type });

  if (uploadError) return { error: "Échec de l'envoi de l'image." };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  // A stable key means a stable public URL, which browsers/CDNs would
  // otherwise cache indefinitely across re-uploads — bust it so the new
  // photo actually shows up.
  const { error: updateError } = await supabase
    .from("profiles")
    .update({ avatar_url: `${publicUrl}?v=${Date.now()}` })
    .eq("id", user.id);

  if (updateError) return { error: `Photo envoyée mais profil non mis à jour : ${updateError.message}` };

  return { success: "Photo mise à jour." };
}

const changeEmailSchema = z.string().trim().email("Adresse email invalide.");

export async function updateEmail(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = changeEmailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Adresse email invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (parsed.data.toLowerCase() === user.email?.toLowerCase()) {
    return { error: "C'est déjà votre adresse email actuelle." };
  }

  const existingProviders = await findAccountProvidersByEmail(parsed.data);
  if (existingProviders) {
    return {
      error: `Cet email est déjà utilisé par un autre compte (connexion via ${existingProviders.join(" ou ")}).`,
    };
  }

  const { error } = await supabase.auth.updateUser(
    { email: parsed.data },
    {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent("/app/account?tab=security")}`,
    },
  );

  if (error) return { error: error.message };

  return {
    success: `Email de confirmation envoyé à ${parsed.data} — cliquez sur le lien pour valider le changement.`,
  };
}

const setPasswordSchema = z.string().min(8, "8 caractères minimum.");

export async function setPassword(
  _prevState: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = setPasswordSchema.safeParse(formData.get("password"));
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Mot de passe invalide." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { error: error.message };

  return { success: "Mot de passe défini." };
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
