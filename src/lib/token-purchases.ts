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

// A single transactional RPC (see migration 0028) — the idempotent insert
// into token_purchases (unique constraint on stripe_checkout_session_id,
// migration 0008) and the token_balance credit happen in the same
// Postgres transaction, so a retried webhook delivery can't observe a
// half-applied state between the two.
export async function creditTokenPurchase(
  supabase: ServiceClient,
  params: CreditTokenPurchaseParams,
): Promise<CreditTokenPurchaseResult> {
  const { data, error } = await supabase.rpc("credit_tokens", {
    p_user_id: params.userId,
    p_session_id: params.stripeCheckoutSessionId,
    p_tokens: params.tokens,
    p_amount_cents: params.amountCents,
  });

  if (error) {
    console.error("Échec credit_tokens RPC", error);
    return { credited: false, reason: "invalid" };
  }

  if (data === "credited") {
    return { credited: true };
  }

  return { credited: false, reason: data === "duplicate" ? "duplicate" : "invalid" };
}
