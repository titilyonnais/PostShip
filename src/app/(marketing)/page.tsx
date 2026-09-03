import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  Check,
  Image as ImageIcon,
  Sparkles,
  Webhook,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ApercuFrame } from "@/components/marketing/product-frame";
import { Reveal } from "@/components/reveal";
import { PLAN_LABEL, PUBLIC_PLANS } from "@/lib/pricing";
import { DemoForm } from "./demo-form";

const JSON_LD = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "PostShip",
  url: "https://postship.fr",
  inLanguage: "fr-FR",
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
    title: "Votre carte sociale reste montrable",
    items: [
      "Image accessible, bon format, pas trop lourde",
      "Titre et description toujours présents",
      "Aperçu réel dans le tableau de bord",
    ],
  },
];

const STACK_GROUPS = [
  { label: "Déploiements", icon: Webhook, tools: ["Vercel", "Netlify", "Cloudflare Pages"] },
  { label: "Alertes", icon: Bell, tools: ["Discord", "Slack", "Telegram", "Email"] },
];

export default function MarketingHomePage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-24 px-6 py-16 sm:px-10">
      {/* Static, hardcoded JSON-LD — no user input reaches this. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
      />

      <section className="relative grid gap-10 overflow-hidden sm:grid-cols-2 sm:items-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -inset-x-6 -top-16 -bottom-16 -z-10 bg-gradient-to-b from-background via-[#0d1510] to-background sm:-inset-x-10"
        />
        <div className="flex flex-col gap-4">
          <h1 className="text-4xl font-semibold tracking-tight text-balance sm:text-5xl">
            PostShip vérifie votre site après chaque déploiement
          </h1>
          <p className="max-w-lg text-base text-muted-foreground">
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
            <Link
              href="#demo"
              className={buttonVariants({ variant: "outline" })}
            >
              Voir un check
            </Link>
          </div>
          <span className="text-xs text-muted-foreground">
            Gratuit jusqu&apos;à 3 URLs — aucune carte requise
          </span>
          <p className="text-xs text-muted-foreground">
            Vercel · Netlify · Cloudflare Pages · Discord · Slack · Telegram
          </p>
        </div>

        <ApercuFrame />
      </section>

      <section aria-labelledby="steps-heading" className="flex flex-col gap-8">
        <h2
          id="steps-heading"
          className="text-xl font-semibold tracking-tight sm:text-2xl"
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
              <span className="font-mono text-2xl text-muted-foreground/70">
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
          className="text-xl font-semibold tracking-tight sm:text-2xl"
        >
          Ce que PostShip surveille
        </h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {CHECKS.map((check, index) => (
            <div
              key={check.title}
              className="flex flex-col gap-3 rounded-2xl border border-border p-5 transition-colors duration-200 hover:border-foreground/25 focus-within:border-foreground/25 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <check.icon
                className="size-4 text-muted-foreground"
                aria-hidden="true"
              />
              <h3 className="text-base font-medium">{check.title}</h3>
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

      <Reveal>
        <section aria-labelledby="stack-heading" className="flex flex-col gap-6">
          <h2
            id="stack-heading"
            className="text-center text-xl font-semibold tracking-tight sm:text-2xl"
          >
            Compatible avec votre stack
          </h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {STACK_GROUPS.map((group) => (
              <div
                key={group.label}
                className="flex flex-col gap-3 rounded-2xl border border-border p-5"
              >
                <span className="flex items-center gap-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                  <group.icon className="size-3.5 text-brand-2" aria-hidden="true" />
                  {group.label}
                </span>
                <div className="flex flex-wrap gap-2">
                  {group.tools.map((tool) => (
                    <span
                      key={tool}
                      className="rounded-full border border-border bg-secondary/50 px-3 py-1 text-sm"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      </Reveal>

      <section
        id="demo"
        aria-labelledby="demo-heading"
        className="scroll-mt-24 flex flex-col gap-4"
      >
        <h2
          id="demo-heading"
          className="text-center text-xl font-semibold tracking-tight sm:text-2xl"
        >
          Essayez sur une URL publique
        </h2>
        <DemoForm />
      </section>

      <Reveal>
        <section aria-labelledby="pricing-heading" className="flex flex-col gap-6">
          <div className="flex items-center justify-between">
            <h2
              id="pricing-heading"
              className="text-xl font-semibold tracking-tight sm:text-2xl"
            >
              Tarifs
            </h2>
            <Link
              href="/pricing"
              className="flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-brand-2"
            >
              Voir le détail des plans et la FAQ
              <ArrowRight className="size-3" aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {PUBLIC_PLANS.map((plan) => (
              <article
                key={plan.id}
                className={`relative flex flex-col gap-2 rounded-2xl border p-5 transition-colors duration-200 ${
                  plan.highlight
                    ? "border-foreground/30 bg-card ring-1 ring-foreground/30"
                    : "border-border hover:border-foreground/20"
                }`}
              >
                {plan.highlight && (
                  <span className="absolute -top-2.5 right-4 rounded-full bg-brand/15 px-2 py-0.5 text-[0.65rem] font-medium text-brand">
                    Le plus choisi
                  </span>
                )}
                <h3 className="text-sm font-medium">{PLAN_LABEL[plan.id]}</h3>
                <p className="font-mono text-lg">{plan.price}</p>
                <ul className="flex flex-col gap-1 text-xs text-muted-foreground">
                  {plan.features.map((feature) => (
                    <li key={feature}>{feature}</li>
                  ))}
                </ul>
                <Link
                  href={`/login?plan=${plan.id}`}
                  className={buttonVariants({
                    variant: plan.highlight ? "default" : "outline",
                    className: "mt-2",
                  })}
                >
                  Choisir {PLAN_LABEL[plan.id]}
                </Link>
              </article>
            ))}
          </div>
        </section>
      </Reveal>

      <Reveal>
        <section className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-14 text-center">
          <Sparkles className="size-5 text-brand-2" aria-hidden="true" />
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
      </Reveal>
    </div>
  );
}
