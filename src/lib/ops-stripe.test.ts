import { describe, expect, it, vi, beforeEach } from "vitest";
import type Stripe from "stripe";

const { recordOpsEventMock } = vi.hoisted(() => ({
  recordOpsEventMock: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@/lib/ops-events", () => ({ recordOpsEvent: recordOpsEventMock }));

const { recordStripeEvent } = await import("./ops-stripe");

function event(type: string, object: Record<string, unknown>): Stripe.Event {
  return {
    id: "evt_123",
    type,
    livemode: true,
    data: { object },
  } as unknown as Stripe.Event;
}

beforeEach(() => recordOpsEventMock.mockClear());

describe("recordStripeEvent", () => {
  it("marks a failed invoice as a warning worth chasing", async () => {
    await recordStripeEvent(
      event("invoice.payment_failed", {
        id: "in_1",
        customer: "cus_abc",
        amount_due: 1200,
        currency: "eur",
        status: "open",
      }),
    );

    expect(recordOpsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "stripe",
        severity: "warn",
        action: "stripe.invoice.payment_failed",
        target: "cus_abc",
      }),
    );
    expect(recordOpsEventMock.mock.calls[0][0].payload).toMatchObject({
      amount: 1200,
      currency: "eur",
      object_id: "in_1",
    });
  });

  it("marks a dispute as fraud", async () => {
    await recordStripeEvent(
      event("charge.dispute.created", { id: "dp_1", customer: "cus_abc", amount: 4900 }),
    );

    expect(recordOpsEventMock).toHaveBeenCalledWith(
      expect.objectContaining({ severity: "fraud", action: "stripe.charge.dispute.created" }),
    );
  });

  it("files subscription and checkout events under billing, not stripe", async () => {
    await recordStripeEvent(
      event("customer.subscription.updated", { id: "sub_1", customer: "cus_abc" }),
    );
    expect(recordOpsEventMock.mock.calls[0][0].source).toBe("billing");

    recordOpsEventMock.mockClear();
    await recordStripeEvent(event("checkout.session.completed", { id: "cs_1" }));
    expect(recordOpsEventMock.mock.calls[0][0].source).toBe("billing");
  });

  it("defaults to info for the ordinary traffic", async () => {
    await recordStripeEvent(event("invoice.paid", { id: "in_2", customer: "cus_abc" }));
    expect(recordOpsEventMock.mock.calls[0][0].severity).toBe("info");
  });

  it("reads the customer whether Stripe expanded it or not", async () => {
    await recordStripeEvent(event("invoice.paid", { id: "in_3", customer: { id: "cus_xyz" } }));
    expect(recordOpsEventMock.mock.calls[0][0].target).toBe("cus_xyz");

    recordOpsEventMock.mockClear();
    await recordStripeEvent(event("invoice.paid", { id: "in_4" }));
    expect(recordOpsEventMock.mock.calls[0][0].target).toBeNull();
  });
});
