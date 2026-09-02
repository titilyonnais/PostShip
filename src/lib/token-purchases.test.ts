import { describe, expect, it } from "vitest";
import { creditTokenPurchase } from "./token-purchases";
import type { createServiceClient } from "@/lib/db/service";

type ServiceClient = ReturnType<typeof createServiceClient>;

// A minimal in-memory fake standing in for the two tables
// creditTokenPurchase touches — enough to exercise the real idempotency
// branch (insert conflict -> no credit) without a real Postgres unique
// constraint.
function createFakeSupabase() {
  const insertedSessions = new Set<string>();
  const profiles = new Map<string, { token_balance: number }>();

  const client = {
    from(table: string) {
      if (table === "token_purchases") {
        return {
          insert(row: { stripe_checkout_session_id: string }) {
            if (insertedSessions.has(row.stripe_checkout_session_id)) {
              return Promise.resolve({
                error: {
                  message:
                    'duplicate key value violates unique constraint "token_purchases_stripe_checkout_session_id_key"',
                },
              });
            }
            insertedSessions.add(row.stripe_checkout_session_id);
            return Promise.resolve({ error: null });
          },
        };
      }

      throw new Error(`unexpected table in fake client: ${table}`);
    },
    rpc(fn: string, args: { p_user_id: string; p_amount: number }) {
      if (fn !== "increment_token_balance") {
        throw new Error(`unexpected rpc in fake client: ${fn}`);
      }
      const current = profiles.get(args.p_user_id) ?? { token_balance: 0 };
      const next = { token_balance: current.token_balance + args.p_amount };
      profiles.set(args.p_user_id, next);
      return Promise.resolve({ data: next.token_balance, error: null });
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
