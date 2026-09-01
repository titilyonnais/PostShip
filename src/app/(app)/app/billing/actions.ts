"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getStripe, STRIPE_PRICE_IDS } from "@/lib/stripe";

// Any plan change once a subscription already exists — upgrade, downgrade,
// or cancel to Free — goes through the Stripe portal so it modifies the
// existing subscription (with proration) instead of a second Checkout
// Session creating a duplicate one alongside it. Only a first-time
// subscribe (no stripe_subscription_id yet) uses Checkout directly.
export async function changePlan(plan: "free" | "solo" | "team") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, stripe_subscription_id, email")
    .eq("id", user.id)
    .single();

  if (profile?.stripe_subscription_id && profile.stripe_customer_id) {
    let portalUrl: string | null = null;
    try {
      const session = await getStripe().billingPortal.sessions.create({
        customer: profile.stripe_customer_id,
        return_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/billing`,
      });
      portalUrl = session.url;
    } catch {
      redirect(
        `/app/billing?error=${encodeURIComponent("Impossible d'ouvrir le portail de facturation.")}`,
      );
    }
    redirect(portalUrl);
  }

  if (plan === "free") {
    redirect(
      `/app/billing?error=${encodeURIComponent("Vous êtes déjà sur le plan Free.")}`,
    );
  }

  const priceId = STRIPE_PRICE_IDS[plan];
  if (!priceId) {
    redirect(
      `/app/billing?error=${encodeURIComponent("Ce plan n'est pas encore configuré.")}`,
    );
  }

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
