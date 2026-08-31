import Stripe from "stripe";

let stripeClient: Stripe | null = null;

// Constructed on first use, not at module load — Stripe's constructor
// throws immediately if the key is missing, which would crash the build
// and every route that imports this module while no key is configured yet.
export function getStripe(): Stripe {
  if (!stripeClient) {
    stripeClient = new Stripe(process.env.STRIPE_SECRET_KEY!);
  }
  return stripeClient;
}

export const STRIPE_PRICE_IDS: Record<"solo" | "team", string | undefined> = {
  solo: process.env.STRIPE_PRICE_SOLO,
  team: process.env.STRIPE_PRICE_TEAM,
};

export function planFromPriceId(priceId?: string | null): "solo" | "team" | null {
  if (priceId && priceId === process.env.STRIPE_PRICE_SOLO) return "solo";
  if (priceId && priceId === process.env.STRIPE_PRICE_TEAM) return "team";
  return null;
}
