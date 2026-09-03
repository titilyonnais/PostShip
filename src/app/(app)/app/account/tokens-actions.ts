"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getStripe, TOKEN_PACKS, type TokenPackId } from "@/lib/stripe";

export async function buyTokens(packId: TokenPackId) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const pack = TOKEN_PACKS[packId];
  if (!pack?.priceId) {
    redirect(
      `/app/account?tab=tokens&error=${encodeURIComponent("Ce pack de tokens n'est pas encore configuré.")}`,
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .single();

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    // A one-time card charge with no address on file otherwise — Stripe
    // collects and validates it right here instead of relying on the
    // separate (and easy to skip) Facturation form.
    billing_address_collection: "required",
    customer: profile?.stripe_customer_id ?? undefined,
    customer_email: profile?.stripe_customer_id
      ? undefined
      : (profile?.email ?? user.email ?? undefined),
    line_items: [{ price: pack.priceId, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/account?tab=tokens&checkout=tokens_success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/account?tab=tokens&checkout=tokens_cancelled`,
    client_reference_id: user.id,
    metadata: { user_id: user.id, kind: "tokens", tokens: String(pack.tokens) },
  });

  if (!session.url) {
    redirect(
      `/app/account?tab=tokens&error=${encodeURIComponent("Impossible de créer la session Stripe.")}`,
    );
  }

  redirect(session.url);
}
