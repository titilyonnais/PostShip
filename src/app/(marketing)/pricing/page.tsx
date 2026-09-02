import Link from "next/link";
import { Check } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { PLAN_LABEL, PUBLIC_PLANS } from "@/lib/pricing";
import { TOKEN_PACKS } from "@/lib/stripe";
import { LEGAL } from "@/lib/legal";

export const metadata = {
  title: "Tarifs",
};

const TVA_ANSWER =
  LEGAL.tvaMention === "FIXME_LEGAL"
    ? "Mention TVA : en cours de mise à jour."
    : LEGAL.tvaMention;

const FAQ = [
  {
    q: "Je peux changer de plan à tout moment ?",
    a: "Oui, à la hausse comme à la baisse, depuis la page Abonnement. Le changement est proraté par Stripe.",
  },
  {
    q: "Que se passe-t-il si je dépasse mon quota d'URLs ?",
    a: "L'ajout d'une nouvelle URL est bloqué au-delà de la limite de votre plan. Vos vérifications existantes continuent normalement.",
  },
  {
    q: "Combien de temps l'historique est-il conservé ?",
    a: "7 jours en Free, 14 en Solo, 30 en Team. Au-delà, les anciens runs sont purgés automatiquement chaque nuit.",
  },
  {
    q: "Puis-je annuler à tout moment ?",
    a: "Oui, sans engagement, depuis le portail de facturation Stripe accessible dans votre compte.",
  },
  {
    q: "Les prix incluent-ils la TVA ?",
    a: TVA_ANSWER,
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-16 px-6 py-16 sm:px-10">
      <div className="flex flex-col items-center gap-3 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
        <h1 className="text-3xl font-semibold tracking-tight">Tarifs</h1>
        <p className="max-w-md text-sm text-muted-foreground">
          Simple, sans surprise. Choisissez un plan, créez votre compte, et
          PostShip surveille votre site dès la première minute.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PUBLIC_PLANS.map((plan, index) => (
          <div
            key={plan.id}
            className={`flex flex-col gap-4 rounded-md border p-6 transition-colors duration-200 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500 ${
              plan.highlight
                ? "border-foreground/30 bg-card"
                : "border-border hover:border-foreground/20"
            }`}
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <div>
              <h2 className="text-sm font-medium">{PLAN_LABEL[plan.id]}</h2>
              <p className="mt-1 font-mono text-2xl">{plan.price}</p>
            </div>
            <ul className="flex flex-1 flex-col gap-2 text-sm text-muted-foreground">
              {plan.features.map((feature) => (
                <li key={feature} className="flex items-center gap-2">
                  <Check
                    className="size-3.5 shrink-0 text-[#3fb950]"
                    aria-hidden="true"
                  />
                  {feature}
                </li>
              ))}
            </ul>
            <Link
              href={`/login?plan=${plan.id}`}
              className={buttonVariants({
                variant: plan.highlight ? "default" : "outline",
              })}
            >
              {plan.id === "free" ? "Commencer gratuitement" : "Choisir ce plan"}
            </Link>
          </div>
        ))}
      </div>
      <p className="text-center text-xs text-muted-foreground">{TVA_ANSWER}</p>

      <section
        id="tokens"
        aria-labelledby="tokens-heading"
        className="flex flex-col gap-6 scroll-mt-16"
      >
        <div className="flex flex-col items-center gap-2 text-center">
          <h2
            id="tokens-heading"
            className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
          >
            Tokens — scan de site à la demande
          </h2>
          <p className="max-w-md text-sm text-muted-foreground">
            En plus de la surveillance continue, scannez tout votre site en
            un clic (sitemap + liens de la home, jusqu&apos;à 500 pages).
            Achat unique, indépendant de l&apos;abonnement — pas
            d&apos;expiration, pas de remboursement une fois consommé.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {Object.values(TOKEN_PACKS).map((pack) => (
            <div
              key={pack.tokens}
              className="flex flex-col gap-2 rounded-md border border-border bg-card p-6"
            >
              <p className="font-mono text-2xl">{pack.priceLabel}</p>
              <p className="text-sm font-medium">{pack.tokens} tokens</p>
              <p className="text-sm text-muted-foreground">{pack.blurb}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">
          1 token = 1 page scannée. Achetables depuis votre compte, une fois
          connecté.
        </p>
      </section>

      <section aria-labelledby="faq-heading" className="flex flex-col gap-6">
        <h2
          id="faq-heading"
          className="text-xs font-medium tracking-wide text-muted-foreground uppercase"
        >
          Questions fréquentes
        </h2>
        <div className="grid gap-6 sm:grid-cols-2">
          {FAQ.map((item) => (
            <div key={item.q} className="flex flex-col gap-1.5">
              <h3 className="text-sm font-medium">{item.q}</h3>
              <p className="text-sm text-muted-foreground">{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
