"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/db/server";
import { createServiceClient } from "@/lib/db/service";
import { linkPendingProjectInvites } from "@/lib/project-members";
import { getStripe, STRIPE_PRICE_IDS } from "@/lib/stripe";

const planSchema = z.enum(["free", "solo", "team"]).nullable();

const onboardingSchema = z.object({
  full_name: z.string().trim().min(1, "Le nom complet est requis.").max(120),
  company_name: z.string().trim().max(120).optional(),
  phone: z.string().trim().max(30).optional(),
  team_size: z.enum(["solo", "2-5", "6-20", "20+"]).optional(),
  billing_line1: z.string().trim().max(200).optional(),
  billing_line2: z.string().trim().max(200).optional(),
  billing_city: z.string().trim().max(120).optional(),
  billing_postal_code: z.string().trim().max(20).optional(),
  billing_country: z.string().trim().max(2).optional(),
});

export type OnboardingState = { error: string | null };

export async function completeOnboarding(
  plan: string | null,
  _prevState: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const parsedPlan = planSchema.safeParse(plan);
  const targetPlan = parsedPlan.success ? parsedPlan.data : null;

  const parsed = onboardingSchema.safeParse({
    full_name: formData.get("full_name"),
    company_name: formData.get("company_name") || undefined,
    phone: formData.get("phone") || undefined,
    team_size: formData.get("team_size") || undefined,
    billing_line1: formData.get("billing_line1") || undefined,
    billing_line2: formData.get("billing_line2") || undefined,
    billing_city: formData.get("billing_city") || undefined,
    billing_postal_code: formData.get("billing_postal_code") || undefined,
    billing_country: formData.get("billing_country") || undefined,
  });

  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Formulaire invalide." };
  }

  const isPaidSignup = targetPlan === "solo" || targetPlan === "team";
  const {
    billing_line1,
    billing_city,
    billing_postal_code,
    billing_country,
  } = parsed.data;

  if (
    isPaidSignup &&
    (!billing_line1 || !billing_city || !billing_postal_code || !billing_country)
  ) {
    return { error: "Adresse de facturation requise pour un plan payant." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const billingAddress = billing_line1
    ? {
        line1: billing_line1,
        line2: parsed.data.billing_line2 || null,
        city: billing_city,
        postal_code: billing_postal_code,
        country: billing_country,
      }
    : null;

  await supabase.from("profiles").upsert({
    id: user.id,
    email: user.email,
    full_name: parsed.data.full_name,
    company_name: parsed.data.company_name || null,
    phone: parsed.data.phone || null,
    team_size: parsed.data.team_size || null,
    billing_address: billingAddress,
  });

  if (user.email) {
    await linkPendingProjectInvites(createServiceClient(), user.id, user.email);
  }

  if (!isPaidSignup) {
    redirect("/app");
  }

  const priceId = STRIPE_PRICE_IDS[targetPlan];
  if (!priceId) {
    redirect("/app/billing");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .single();

  let customerId = profile?.stripe_customer_id ?? undefined;

  if (!customerId) {
    const customer = await getStripe().customers.create({
      email: profile?.email ?? user.email ?? undefined,
      name: parsed.data.full_name,
      phone: parsed.data.phone || undefined,
      address: billingAddress
        ? {
            line1: billingAddress.line1,
            line2: billingAddress.line2 ?? undefined,
            city: billingAddress.city,
            postal_code: billingAddress.postal_code,
            country: billingAddress.country,
          }
        : undefined,
    });
    customerId = customer.id;
    // stripe_customer_id is a service-role-only column (see migration 0013) —
    // even though this is the user's own onboarding flow, the write has to
    // go through the service client now that `authenticated` can't touch it.
    await createServiceClient()
      .from("profiles")
      .update({ stripe_customer_id: customerId })
      .eq("id", user.id);
  }

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    billing_address_collection: "required",
    customer: customerId,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/billing?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/app?checkout=cancelled`,
    client_reference_id: user.id,
    metadata: { user_id: user.id },
  });

  if (!session.url) {
    redirect("/app/billing");
  }

  redirect(session.url);
}
