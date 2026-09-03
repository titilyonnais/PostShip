import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Check,
  Image as ImageIcon,
  Sparkles,
  Webhook,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PLAN_LABEL, PUBLIC_PLANS } from "@/lib/pricing";
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

const LOG_LINES = [
  { ok: true, path: "/", status: 200, meta: "142 ms" },
  { ok: true, path: "/checkout", status: 200, meta: "310 ms" },
  { ok: false, path: "og:image", status: 404, meta: null },
  { ok: true, path: "sitemap.xml", status: null, meta: "10 URLs" },
];

const STEPS = [
  {
    n: "1",
    title: "Ajoutez l'URL de votre projet",
    desc: "Le domaine de prod, plus les pages qui comptent : checkout, login, la home.",
  },
  {
    n: "2",
    title: "PostShip vérifie après chaque déploiement",
    desc: "Sur le webhook Vercel dès que ça déploie, sinon toutes les 5 à 30 min selon votre plan.",
  },
  {
    n: "3",
    title: "Vous êtes alerté seulement si ça casse",
    desc: "Discord et email groupés, avec le détail de ce qui a échoué. Rien si tout est vert.",
  },
];

const CHECKS = [
  {
    icon: Webhook,
    title: "Le deploy ne part plus en silence",
    items: [
      "Vérification immédiate dès le webhook (Vercel, Netlify, Cloudflare)",
      "Résultat sur GitHub / webhook en moins d'une minute",
      "Alerte Discord, Slack ou Telegram si ça casse",
    ],
  },
  {
    icon: AlertTriangle,
    title: "Le 200 ne suffit plus",
    items: [
      "Un fichier JS ou CSS cassé après déploiement",
      "Le prix a disparu de la page tarifs",
      "Stripe.js absent de la page checkout",
    ],
  },
  {
    icon: ImageIcon,
    title: "Ta carte sociale est encore montrable",
    items: [
      "Image accessible, bon format, pas trop lourde",
      "Titre et description toujours présents",
      "Aperçu réel dans le tableau de bord",
    ],
  },
];

export default function MarketingHomePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-6 py-16 sm:px-10">
      {/* Static, hardcoded JSON-LD — no user input reaches this. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      <section className="grid gap-10 sm:grid-cols-2 sm:items-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold tracking-tight text-balance">
            PostShip vérifie votre site après chaque déploiement
          </h1>
          <p className="max-w-md text-sm text-muted-foreground">
            Comme un utilisateur : statut HTTP, JS et prix toujours présents,
            aperçu réseaux sociaux, sitemap, SSL. Une alerte Discord, Slack,
            Telegram ou email si ça casse. Silence quand tout est vert.
          </p>
          <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:gap-3">
            <Link
              href="/login?plan=free"
              className={buttonVariants({ variant: "default" })}
            >
              Commencer gratuitement
            </Link>
            <span className="text-xs text-muted-foreground">
              Gratuit jusqu&apos;à 3 URLs — aucune carte requise
            </span>
          </div>
        </div>

        <div
          className="rounded-2xl border border-border bg-card font-mono text-xs shadow-[0_0_0_1px_rgba(255,255,255,0.02)]"
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
            {LOG_LINES.map((line, index) => (
              <div
                key={line.path}
                className="flex items-center gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-left-1"
                style={{ animationDelay: `${400 + index * 120}ms` }}
              >
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
            <div
              className="mt-1 flex items-center gap-2 border-t border-border pt-2 text-[#d29922] motion-safe:animate-in motion-safe:fade-in"
              style={{ animationDelay: "900ms" }}
            >
              <span
                className="size-1.5 shrink-0 rounded-full bg-[#d29922] motion-safe:animate-pulse"
                aria-hidden="true"
              />
              1 échec détecté → Discord + email envoyés
            </div>
          </div>
        </div>
      </section>

      <section aria-labelledby="steps-heading" className="flex flex-col gap-8">
        <h2
          id="steps-heading"
          className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          Comment ça marche
        </h2>
        <div className="grid gap-8 sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <div
              key={step.n}
              className="flex flex-col gap-2 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <span className="font-mono text-2xl text-muted-foreground/50">
                {step.n}
              </span>
              <h3 className="text-sm font-medium">{step.title}</h3>
              <p className="text-xs text-muted-foreground">{step.desc}</p>
            </div>
          ))}
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
          {CHECKS.map((check, index) => (
            <div
              key={check.title}
              className="flex flex-col gap-3 rounded-md border border-border p-5 transition-colors duration-200 hover:border-foreground/25 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <check.icon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <h3 className="text-sm font-medium">{check.title}</h3>
              <ul className="flex flex-col gap-1.5 text-xs text-muted-foreground">
                {check.items.map((item) => (
                  <li key={item} className="flex items-start gap-1.5">
                    <Check
                      className="mt-0.5 size-3 shrink-0 text-[#3fb950]"
                      aria-hidden="true"
                    />
                    {item}
                  </li>
                ))}
              </ul>
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
        <div className="flex items-center justify-between">
          <h2
            id="pricing-heading"
            className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            Tarifs
          </h2>
          <Link
            href="/pricing"
            className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
          >
            Voir le détail des plans et la FAQ
            <ArrowRight className="size-3" aria-hidden="true" />
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {PUBLIC_PLANS.map((plan, index) => (
            <Link
              key={plan.id}
              href={`/login?plan=${plan.id}`}
              className={`flex flex-col gap-2 rounded-md border p-5 transition-colors duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 ${
                plan.highlight
                  ? "border-foreground/30 bg-card hover:border-foreground/50"
                  : "border-border hover:border-foreground/20"
              }`}
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <h3 className="text-sm font-medium">{PLAN_LABEL[plan.id]}</h3>
              <p className="font-mono text-lg">{plan.price}</p>
              <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                {plan.features.map((feature) => (
                  <li key={feature}>{feature}</li>
                ))}
              </ul>
            </Link>
          ))}
        </div>
      </section>

      <section className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-14 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
        <Sparkles className="size-5 text-muted-foreground" aria-hidden="true" />
        <h2 className="text-2xl font-semibold tracking-tight">
          Sachez avant vos utilisateurs, pas dans les commentaires
        </h2>
        <p className="max-w-md text-sm text-muted-foreground">
          Un déploiement cassé coûte des clients avant que vous ne le
          sachiez. PostShip vous le dit en premier.
        </p>
        <Link
          href="/login?plan=free"
          className={buttonVariants({ variant: "default" })}
        >
          Commencer gratuitement
        </Link>
      </section>
    </div>
  );
}
