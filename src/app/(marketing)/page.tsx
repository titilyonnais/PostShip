import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { DemoForm } from "./demo-form";

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "PostShip",
  applicationCategory: "DeveloperApplication",
  operatingSystem: "Web",
  description:
    "Surveillance post-déploiement pour sites et SaaS indie : HTTP, Open Graph, sitemap, SSL. Alerte Discord et email si ça casse.",
  offers: [
    { "@type": "Offer", name: "Free", price: "0", priceCurrency: "EUR" },
    { "@type": "Offer", name: "Solo", price: "12", priceCurrency: "EUR" },
    { "@type": "Offer", name: "Team", price: "29", priceCurrency: "EUR" },
  ],
};

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

const LOG_LINES = [
  { ok: true, path: "/", status: 200, meta: "142 ms" },
  { ok: true, path: "/checkout", status: 200, meta: "310 ms" },
  { ok: false, path: "og:image", status: 404, meta: null },
  { ok: true, path: "sitemap.xml", status: null, meta: "10 URLs" },
];

const PLANS: {
  name: string;
  price: string;
  features: string[];
  highlight?: boolean;
}[] = [
  {
    name: "Free",
    price: "0€ TTC / mois",
    features: ["1 projet", "3 URLs", "Toutes les 30 min", "Alertes email"],
  },
  {
    name: "Solo",
    price: "12€ TTC / mois",
    features: ["3 projets", "15 URLs", "Toutes les 5 min", "Discord + Vercel"],
    highlight: true,
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
    <div className="mx-auto flex max-w-3xl flex-col gap-20 px-6 py-16">
      {/* Static, hardcoded JSON-LD — no user input reaches this. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      <section className="grid gap-8 sm:grid-cols-2 sm:items-center">
        <div className="flex flex-col gap-4">
          <h1 className="text-3xl font-semibold tracking-tight text-balance">
            PostShip vérifie votre site après chaque déploiement
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Comme un utilisateur : statut HTTP, aperçu réseaux sociaux,
            sitemap, SSL. Une alerte Discord et email si le checkout, l&apos;OG
            ou le sitemap est cassé. Silence quand tout est vert.
          </p>
          <div>
            <Link
              href="/login"
              className={buttonVariants({ variant: "default" })}
            >
              Commencer gratuitement
            </Link>
          </div>
        </div>

        <div
          className="rounded-md border border-border bg-card font-mono text-xs"
          role="img"
          aria-label="Exemple de résultat de vérification : deux pages en 200, l'image Open Graph en échec 404, sitemap valide avec 10 URLs, un échec détecté déclenche une alerte"
        >
          <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
            <span className="size-2 rounded-full bg-[#f85149]" />
            <span className="size-2 rounded-full bg-[#d29922]" />
            <span className="size-2 rounded-full bg-[#3fb950]" />
            <span className="ml-2 text-muted-foreground">
              postship check --project acme
            </span>
          </div>
          <div className="flex flex-col gap-1.5 px-3 py-3">
            {LOG_LINES.map((line) => (
              <div key={line.path} className="flex items-center gap-2">
                <span
                  className={line.ok ? "text-[#3fb950]" : "text-[#f85149]"}
                  aria-hidden="true"
                >
                  {line.ok ? "✓" : "✗"}
                </span>
                <span className="flex-1 truncate text-foreground">
                  {line.path}
                </span>
                {line.status && (
                  <span className="text-muted-foreground">{line.status}</span>
                )}
                {line.meta && (
                  <span className="text-muted-foreground">{line.meta}</span>
                )}
              </div>
            ))}
            <div className="mt-1 flex items-center gap-2 border-t border-border pt-2 text-[#d29922]">
              <span
                className="size-1.5 shrink-0 rounded-full bg-[#d29922] motion-safe:animate-pulse"
                aria-hidden="true"
              />
              1 échec détecté → Discord + email envoyés
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="checks-heading" className="flex flex-col gap-6">
        <h2
          id="checks-heading"
          className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          Ce que PostShip surveille
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {CHECKS.map((check) => (
            <div
              key={check.title}
              className="rounded-md border border-border p-4"
            >
              <h3 className="text-sm font-medium">{check.title}</h3>
              <p className="mt-2 text-xs text-muted-foreground">
                {check.desc}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section aria-labelledby="demo-heading" className="flex flex-col gap-4">
        <h2
          id="demo-heading"
          className="text-center text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          Essayez sur une URL publique
        </h2>
        <DemoForm />
      </section>

      <section aria-labelledby="pricing-heading" className="flex flex-col gap-6">
        <h2
          id="pricing-heading"
          className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          Tarifs
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`flex flex-col gap-2 rounded-md border p-4 ${
                plan.highlight
                  ? "border-foreground/30 bg-card"
                  : "border-border"
              }`}
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
        </div>
      </section>
    </div>
  );
}
