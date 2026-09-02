import type { createServiceClient } from "@/lib/db/service";

type ServiceClient = ReturnType<typeof createServiceClient>;

export type CreditTokenPurchaseParams = {
  userId: string;
  stripeCheckoutSessionId: string;
  tokens: number;
  amountCents: number;
};

export type CreditTokenPurchaseResult =
  | { credited: true }
  | { credited: false; reason: "duplicate" | "invalid" };

// Split out of the Stripe webhook handler so the idempotency logic (insert
// first, only credit if the insert wasn't a duplicate) is unit-testable
// without a real Postgres unique constraint. The insert into
// token_purchases IS what makes this safe against a retried webhook
// delivery — the unique index on stripe_checkout_session_id (see migration
// 0008) turns a second insert for the same session into a conflict, and
// this function must never credit the balance when that happens.
export async function creditTokenPurchase(
  supabase: ServiceClient,
  params: CreditTokenPurchaseParams,
): Promise<CreditTokenPurchaseResult> {
  if (!params.userId || params.tokens <= 0) {
    return { credited: false, reason: "invalid" };
  }

  const { error: insertError } = await supabase.from("token_purchases").insert({
    user_id: params.userId,
    stripe_checkout_session_id: params.stripeCheckoutSessionId,
    tokens: params.tokens,
    amount_cents: params.amountCents,
  });

  if (insertError) {
    return { credited: false, reason: "duplicate" };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("token_balance")
    .eq("id", params.userId)
    .single();

  await supabase
    .from("profiles")
    .update({ token_balance: (profile?.token_balance ?? 0) + params.tokens })
    .eq("id", params.userId);

  return { credited: true };
}
