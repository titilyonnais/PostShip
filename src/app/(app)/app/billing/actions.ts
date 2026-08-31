"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getStripe, STRIPE_PRICE_IDS } from "@/lib/stripe";

export async function startCheckout(plan: "solo" | "team") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const priceId = STRIPE_PRICE_IDS[plan];
  if (!priceId) {
    redirect(
      `/app/billing?error=${encodeURIComponent("Ce plan n'est pas encore configuré.")}`,
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .single();

  const session = await getStripe().checkout.sessions.create({
    mode: "subscription",
    customer: profile?.stripe_customer_id ?? undefined,
    customer_email: profile?.stripe_customer_id
      ? undefined
      : (profile?.email ?? user.email ?? undefined),
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/billing?checkout=success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/billing?checkout=cancelled`,
    client_reference_id: user.id,
    metadata: { user_id: user.id },
  });

  if (!session.url) {
    redirect(
      `/app/billing?error=${encodeURIComponent("Impossible de créer la session Stripe.")}`,
    );
  }

  redirect(session.url);
}

export async function openBillingPortal() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id")
    .eq("id", user.id)
    .single();

  if (!profile?.stripe_customer_id) {
    redirect(
      `/app/billing?error=${encodeURIComponent("Aucun abonnement actif.")}`,
    );
  }

  const session = await getStripe().billingPortal.sessions.create({
    customer: profile.stripe_customer_id,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/billing`,
  });

  redirect(session.url);
}
