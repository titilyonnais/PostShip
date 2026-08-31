import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { DemoForm } from "./demo-form";

const CHECKS = [
  {
    title: "HTTP & redirections",
    desc: "Statut, TTFB, boucle de redirection détectée avant vos utilisateurs.",
  },
  {
    title: "OG, sitemap & JSON-LD",
    desc: "og:image accessible, sitemap.xml valide, JSON-LD sans erreur de syntaxe.",
  },
  {
    title: "SSL & Stripe",
    desc: "Certificat qui expire bientôt, page de succès Stripe cassée.",
  },
];

const PLANS: {
  name: string;
  price: string;
  features: string[];
}[] = [
  {
    name: "Free",
    price: "0€ TTC / mois",
    features: ["1 projet", "3 URLs", "Toutes les 30 min", "Alertes email"],
  },
  {
    name: "Solo",
    price: "12€ TTC / mois",
    features: [
      "3 projets",
      "15 URLs",
      "Toutes les 5 min",
      "Discord + Vercel",
    ],
  },
  {
    name: "Team",
    price: "29€ TTC / mois",
    features: [
      "10 projets",
      "50 URLs",
      "Vérif. Stripe",
      "Rétention 30 jours",
    ],
  },
];

export default function MarketingHomePage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-16 p-8">
      <section className="flex flex-col items-center gap-4 pt-16 text-center">
        <h1 className="text-3xl font-semibold tracking-tight">PostShip</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Après chaque déploiement, PostShip vérifie vos URLs critiques comme
          un utilisateur. Alerte Discord + email si le checkout, l&apos;OG ou
          le sitemap est cassé. Silence si tout est vert.
        </p>
        <Link href="/login" className={buttonVariants({ variant: "default" })}>
          Commencer gratuitement
        </Link>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {CHECKS.map((check) => (
          <div key={check.title} className="border border-border p-4">
            <h2 className="text-sm font-medium">{check.title}</h2>
            <p className="mt-2 text-xs text-muted-foreground">
              {check.desc}
            </p>
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-4">
        <h2 className="text-center text-sm font-medium text-muted-foreground">
          Essayez sur une URL publique
        </h2>
        <DemoForm />
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className="flex flex-col gap-2 border border-border p-4"
          >
            <h3 className="text-sm font-medium">{plan.name}</h3>
            <p className="font-mono text-lg">{plan.price}</p>
            <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
              {plan.features.map((feature) => (
                <li key={feature}>{feature}</li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <footer className="flex justify-center gap-4 pb-8 text-xs text-muted-foreground">
        <Link href="/privacy" className="hover:underline">
          Confidentialité
        </Link>
        <Link href="/terms" className="hover:underline">
          CGU
        </Link>
      </footer>
    </main>
  );
}
