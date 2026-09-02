import type { Plan } from "@/lib/entitlements";

export const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  solo: "Solo",
  team: "Team",
};

export const PUBLIC_PLANS: {
  id: Plan;
  price: string;
  features: string[];
  highlight?: boolean;
}[] = [
  {
    id: "free",
    price: "0€ TTC / mois",
    features: ["1 projet", "3 URLs", "Toutes les 30 min", "Alertes email"],
  },
  {
    id: "solo",
    price: "12€ TTC / mois",
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
    price: "29€ TTC / mois",
    features: [
      "10 projets",
      "50 URLs",
      "Discord + hooks Vercel/Netlify/Cloudflare",
      "Vérification Stripe",
      "Rétention 30 jours",
    ],
  },
];
