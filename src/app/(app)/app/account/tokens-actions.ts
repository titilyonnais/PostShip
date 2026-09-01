"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import { getStripe, STRIPE_PRICE_TOKENS_1000 } from "@/lib/stripe";

export async function buyTokens() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  if (!STRIPE_PRICE_TOKENS_1000) {
    redirect(
      `/app/account?error=${encodeURIComponent("Les packs de tokens ne sont pas encore configurés.")}`,
    );
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("stripe_customer_id, email")
    .eq("id", user.id)
    .single();

  const session = await getStripe().checkout.sessions.create({
    mode: "payment",
    customer: profile?.stripe_customer_id ?? undefined,
    customer_email: profile?.stripe_customer_id
      ? undefined
      : (profile?.email ?? user.email ?? undefined),
    line_items: [{ price: STRIPE_PRICE_TOKENS_1000, quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/account?checkout=tokens_success`,
    cancel_url: `${process.env.NEXT_PUBLIC_APP_URL}/app/account?checkout=tokens_cancelled`,
    client_reference_id: user.id,
    metadata: { user_id: user.id, kind: "tokens", tokens: "1000" },
  });

  if (!session.url) {
    redirect(
      `/app/account?error=${encodeURIComponent("Impossible de créer la session Stripe.")}`,
    );
  }

  redirect(session.url);
}
