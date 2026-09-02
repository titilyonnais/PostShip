import { describe, expect, it } from "vitest";
import { creditTokenPurchase } from "./token-purchases";
import type { createServiceClient } from "@/lib/db/service";

type ServiceClient = ReturnType<typeof createServiceClient>;

// Simulates the credit_tokens() RPC (migration 0028): insert +
// balance-update in one call, idempotent on stripe_checkout_session_id —
// close enough to the real Postgres unique constraint to exercise the
// idempotency branch without a real database.
function createFakeSupabase() {
  const insertedSessions = new Set<string>();
  const profiles = new Map<string, { token_balance: number }>();

  const client = {
    rpc(
      fn: string,
      args: {
        p_user_id: string;
        p_session_id: string;
        p_tokens: number;
        p_amount_cents: number;
      },
    ) {
      if (fn !== "credit_tokens") {
        throw new Error(`unexpected rpc in fake client: ${fn}`);
      }

      if (!args.p_tokens || args.p_tokens <= 0 || !args.p_user_id || !args.p_session_id) {
        return Promise.resolve({ data: "invalid", error: null });
      }

      if (insertedSessions.has(args.p_session_id)) {
        return Promise.resolve({ data: "duplicate", error: null });
      }
      insertedSessions.add(args.p_session_id);

      const current = profiles.get(args.p_user_id) ?? { token_balance: 0 };
      profiles.set(args.p_user_id, {
        token_balance: current.token_balance + args.p_tokens,
      });

      return Promise.resolve({ data: "credited", error: null });
    },
  };

  return { client: client as unknown as ServiceClient, profiles };
}

describe("creditTokenPurchase", () => {
  it("credits the balance on first delivery", async () => {
    const { client, profiles } = createFakeSupabase();

    const result = await creditTokenPurchase(client, {
      userId: "user-1",
      stripeCheckoutSessionId: "cs_test_123",
      tokens: 500,
      amountCents: 300,
    });

    expect(result).toEqual({ credited: true });
    expect(profiles.get("user-1")?.token_balance).toBe(500);
  });

  it("does not double-credit a retried webhook delivery for the same session", async () => {
    const { client, profiles } = createFakeSupabase();
    const params = {
      userId: "user-1",
      stripeCheckoutSessionId: "cs_test_123",
      tokens: 500,
      amountCents: 300,
    };

    const first = await creditTokenPurchase(client, params);
    const retry = await creditTokenPurchase(client, params);

    expect(first).toEqual({ credited: true });
    expect(retry).toEqual({ credited: false, reason: "duplicate" });
    // Not 1000 — the retry must not add a second 500.
    expect(profiles.get("user-1")?.token_balance).toBe(500);
  });

  it("adds to an existing balance rather than overwriting it", async () => {
    const { client, profiles } = createFakeSupabase();
    profiles.set("user-1", { token_balance: 250 });

    await creditTokenPurchase(client, {
      userId: "user-1",
      stripeCheckoutSessionId: "cs_test_456",
      tokens: 1000,
      amountCents: 500,
    });

    expect(profiles.get("user-1")?.token_balance).toBe(1250);
  });

  it("rejects a missing user id without touching the tables", async () => {
    const { client, profiles } = createFakeSupabase();

    const result = await creditTokenPurchase(client, {
      userId: "",
      stripeCheckoutSessionId: "cs_test_789",
      tokens: 500,
      amountCents: 300,
    });

    expect(result).toEqual({ credited: false, reason: "invalid" });
    expect(profiles.size).toBe(0);
  });

  it("rejects a non-positive token amount", async () => {
    const { client } = createFakeSupabase();

    const result = await creditTokenPurchase(client, {
      userId: "user-1",
      stripeCheckoutSessionId: "cs_test_000",
      tokens: 0,
      amountCents: 0,
    });

    expect(result).toEqual({ credited: false, reason: "invalid" });
  });
});
