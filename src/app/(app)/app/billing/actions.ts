"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import type Stripe from "stripe";
import { getStripe, STRIPE_PRICE_IDS } from "@/lib/stripe";

// Any plan change once a subscription already exists — upgrade, downgrade,
// or cancel to Free — goes through the Stripe portal so it modifies the
// existing subscription (with proration) instead of a second Checkout
// Session creating a duplicate one alongside it. Only a first-time
// subscribe (no stripe_subscription_id yet) uses Checkout directly.
// A plan change on an existing subscription has to modify that
// subscription rather than open a second one beside it, so it goes
// through the Stripe portal. What it must not do — and did — is drop the
// customer on the portal's home page: they clicked "Team" and landed on a
// generic billing screen with no idea what happened to their choice.
//
// flow_data turns the same session into a deep link. subscription_update_confirm
// opens directly on a confirmation of the exact price that was clicked;
// subscription_update opens the plan picker, which is the honest fallback
// when the subscription has several items and Stripe cannot confirm one
// in a single step.
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
      const stripe = getStripe();
      const subscription = await stripe.subscriptions.retrieve(
        profile.stripe_subscription_id,
      );

      // A cancelled or otherwise dead subscription can't be updated —
      // that customer is re-subscribing, which is Checkout's job, not the
      // portal's.
      const live = ["active", "trialing", "past_due", "unpaid"].includes(
        subscription.status,
      );

      if (live) {
        const item = subscription.items.data[0];
        const targetPrice = plan === "free" ? null : STRIPE_PRICE_IDS[plan];

        const flow: Stripe.BillingPortal.SessionCreateParams.FlowData =
          plan === "free"
            ? {
                type: "subscription_cancel",
                subscription_cancel: { subscription: subscription.id },
              }
            : targetPrice && item && subscription.items.data.length === 1
              ? {
                  type: "subscription_update_confirm",
                  subscription_update_confirm: {
                    subscription: subscription.id,
                    items: [
                      { id: item.id, price: targetPrice, quantity: item.quantity ?? 1 },
                    ],
                  },
                }
              : {
                  type: "subscription_update",
                  subscription_update: { subscription: subscription.id },
                };

        const session = await stripe.billingPortal.sessions.create({
          customer: profile.stripe_customer_id,
          return_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/billing`,
          flow_data: {
            ...flow,
            // Back to our own page once it's done, rather than leaving
            // the customer sitting in Stripe's portal wondering whether
            // it worked.
            after_completion: {
              type: "redirect",
              redirect: {
                return_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/billing?checkout=success`,
              },
            },
          },
        });
        portalUrl = session.url;
      }
    } catch (err) {
      console.error("Échec ouverture du portail Stripe", err);
      redirect(
        `/app/billing?error=${encodeURIComponent("Impossible d'ouvrir le portail de facturation.")}`,
      );
    }

    // Only redirect when the portal actually produced a URL; otherwise
    // fall through to Checkout below, which is the right path for a
    // subscription that no longer exists.
    if (portalUrl) redirect(portalUrl);
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
    billing_address_collection: "required",
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
