import type { Plan } from "@/lib/entitlements";

// Displayed as "Pro" everywhere in the UI — the internal plan value stays
// "team" in the database and in Stripe (planFromPriceId, webhooks) so this
// is a display-only rename, not a data migration. See docs/PLAN.md.
export const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  solo: "Solo",
  team: "Pro",
};

export const PUBLIC_PLANS: {
  id: Plan;
  price: string;
  subtitle?: string;
  features: string[];
  highlight?: boolean;
}[] = [
  {
    id: "free",
    price: "0€ / mois",
    features: ["1 projet", "3 URLs", "Toutes les 30 min", "Alertes email"],
  },
  {
    id: "solo",
    price: "12€ / mois",
    features: [
      "3 projets",
      "15 URLs",
      "Toutes les 5 min",
      "Discord + hooks Vercel/Netlify/Cloudflare",
    ],
    highlight: true,
  },
  {
    id: "team",
    price: "29€ / mois",
    subtitle: "Pour un indie qui surveille plusieurs produits. Pas de sièges multiples.",
    features: [
      "10 projets",
      "50 URLs",
      "Discord + hooks Vercel/Netlify/Cloudflare",
      "Vérification Stripe",
      "Collaborateurs par projet",
      "Rétention 30 jours",
    ],
  },
];
