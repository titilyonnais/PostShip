import { NextResponse } from "next/server";
import type Stripe from "stripe";
import { createServiceClient } from "@/lib/db/service";
import { getStripe, planFromPriceId } from "@/lib/stripe";
import { creditTokenPurchase } from "@/lib/token-purchases";
import { recordStripeEvent } from "@/lib/ops-stripe";

async function planFromSubscriptionId(
  subscriptionId: string | null | undefined,
): Promise<"solo" | "team" | null> {
  if (!subscriptionId) return null;
  const subscription =
    await getStripe().subscriptions.retrieve(subscriptionId);
  return planFromPriceId(subscription.items.data[0]?.price.id);
}

async function syncSubscription(
  supabase: ReturnType<typeof createServiceClient>,
  subscription: Stripe.Subscription,
) {
  const customerId =
    typeof subscription.customer === "string"
      ? subscription.customer
      : subscription.customer.id;
  const status = subscription.status;
  const priceId = subscription.items.data[0]?.price.id;
  const isActive = status === "active" || status === "trialing";
  const plan = isActive ? (planFromPriceId(priceId) ?? "free") : "free";

  await supabase
    .from("profiles")
    .update({
      stripe_subscription_id: subscription.id,
      stripe_subscription_status: status,
      plan,
    })
    .eq("stripe_customer_id", customerId);
}

export async function POST(request: Request) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature");

  if (!signature) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET!,
    );
  } catch (err) {
    return NextResponse.json(
      {
        error: `Signature invalide: ${err instanceof Error ? err.message : String(err)}`,
      },
      { status: 400 },
    );
  }

  // After signature verification, before any handling: the journal should
  // record what Stripe sent even for event types this switch ignores,
  // which is most of them and includes every dispute.
  await recordStripeEvent(event);

  const supabase = createServiceClient();

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.client_reference_id ?? session.metadata?.user_id;

      if (session.mode === "payment" && session.metadata?.kind === "tokens") {
        const tokens = Number.parseInt(session.metadata.tokens ?? "0", 10);
        if (userId) {
          await creditTokenPurchase(supabase, {
            userId,
            stripeCheckoutSessionId: session.id,
            tokens,
            amountCents: session.amount_total ?? 0,
          });
        }
        break;
      }

      const customerId =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id;
      const subscriptionId =
        typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id;

      if (!userId || !customerId) {
        console.error(
          "checkout.session.completed sans userId/customerId — no-op",
          { eventId: event.id, sessionId: session.id },
        );
        break;
      }

      const plan = await planFromSubscriptionId(subscriptionId);

      if (!plan) {
        // Never guess a plan for a price ID we don't recognize — silently
        // granting/downgrading the wrong tier is worse than leaving the
        // existing value untouched while this gets investigated.
        console.error(
          "checkout.session.completed: price ID non reconnu, plan inchangé",
          { eventId: event.id, subscriptionId },
        );
        await supabase
          .from("profiles")
          .update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId ?? null,
            stripe_subscription_status: "active",
          })
          .eq("id", userId);
        break;
      }

      await supabase
        .from("profiles")
        .update({
          stripe_customer_id: customerId,
          stripe_subscription_id: subscriptionId ?? null,
          stripe_subscription_status: "active",
          plan,
        })
        .eq("id", userId);
      break;
    }

    case "customer.subscription.updated": {
      await syncSubscription(supabase, event.data.object as Stripe.Subscription);
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === "string"
          ? subscription.customer
          : subscription.customer.id;

      await supabase
        .from("profiles")
        .update({ plan: "free", stripe_subscription_status: "canceled" })
        .eq("stripe_customer_id", customerId);
      break;
    }

    default:
      break;
  }

  return NextResponse.json({ received: true });
}
