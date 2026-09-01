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

// Token packs: one-time payment, independent of the subscription plan —
// see src/lib/scan.ts (1 token spent per page scanned).
export type TokenPackId = "500" | "1000" | "5000";

export const TOKEN_PACKS: Record<
  TokenPackId,
  { tokens: number; priceLabel: string; priceId: string | undefined; blurb: string }
> = {
  "500": {
    tokens: 500,
    priceLabel: "3€",
    priceId: process.env.STRIPE_PRICE_TOKENS_500,
    blurb: "Pour scanner ponctuellement un petit site.",
  },
  "1000": {
    tokens: 1000,
    priceLabel: "5€",
    priceId: process.env.STRIPE_PRICE_TOKENS_1000,
    blurb: "Quelques scans réguliers sur vos projets.",
  },
  "5000": {
    tokens: 5000,
    priceLabel: "20€",
    priceId: process.env.STRIPE_PRICE_TOKENS_5000,
    blurb: "Usage intensif, plusieurs sites ou audits fréquents.",
  },
};

export function planFromPriceId(priceId?: string | null): "solo" | "team" | null {
  if (priceId && priceId === process.env.STRIPE_PRICE_SOLO) return "solo";
  if (priceId && priceId === process.env.STRIPE_PRICE_TEAM) return "team";
  return null;
}
