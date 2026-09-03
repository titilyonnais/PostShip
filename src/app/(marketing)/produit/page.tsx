import Link from "next/link";
import { AlertTriangle, Rocket, ShieldCheck, Webhook } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ApercuFrame, DeploysFrame, IncidentsFrame } from "@/components/marketing/product-frame";

export const metadata = {
  title: "Produit",
};

const ARGUMENTS = [
  {
    id: "deploy",
    icon: Webhook,
    title: "Vérifié à la seconde où ça déploie",
    body: "Le webhook Vercel, Netlify ou Cloudflare Pages déclenche une vérification immédiate. Puis un rappel à T+2 et T+8 minutes après le ship, pour attraper ce qui casse une fois le cache et le CDN stabilisés.",
  },
  {
    id: "au-dela-200",
    icon: AlertTriangle,
    title: "Plus loin qu'un simple statut 200",
    body: "HTTP, JS et CSS chargés, prix toujours présents, image et titre Open Graph valides, sitemap qui répond, certificat SSL qui ne va pas expirer. Un radar de mutation détecte aussi un contenu remplacé par « coming soon » ou une erreur 5xx après un déploiement.",
  },
  {
    id: "ship-score",
    icon: ShieldCheck,
    title: "Un score, pas juste vert ou rouge",
    body: "Chaque déploiement en production reçoit un Ship Score sur 100 — moins 40 si une page qui encaisse de l'argent échoue, moins 15 pour une carte sociale cassée, moins 10 pour un certificat qui expire bientôt. Une phrase explique la note.",
  },
  {
    id: "alertes",
    icon: Rocket,
    title: "Alerté seulement si ça casse",
    body: "Email, Discord, Slack ou Telegram — groupés, jamais deux fois la même alerte en moins de 10 minutes. Rien n'est envoyé tant que tout est vert.",
  },
];

export default function ProduitPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-16 px-6 py-16 sm:px-10">
      <div className="flex flex-col gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Ce que PostShip vérifie après un ship
        </h1>
        <p className="max-w-lg text-base text-muted-foreground">
          Un déploiement qui répond en 200 ne veut pas dire qu&apos;il fonctionne.
          PostShip rejoue le comportement d&apos;un vrai visiteur juste après
          chaque mise en production, et vous alerte avant vos utilisateurs.
        </p>
      </div>

      <div className="grid gap-6 sm:grid-cols-2">
        {ARGUMENTS.map((item) => (
          <div
            key={item.title}
            id={item.id}
            className="flex scroll-mt-24 flex-col gap-2 rounded-2xl border border-border p-5 transition-colors duration-200 hover:border-foreground/20"
          >
            <span className="inline-flex size-8 items-center justify-center rounded-lg bg-brand-2/10 text-brand-2">
              <item.icon className="size-4" aria-hidden="true" />
            </span>
            <h2 className="text-base font-medium">{item.title}</h2>
            <p className="text-sm text-muted-foreground">{item.body}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        <ApercuFrame />
        <IncidentsFrame />
        <DeploysFrame />
      </div>

      <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-card px-6 py-12 text-center">
        <p className="max-w-sm text-sm text-muted-foreground">
          Collez une URL publique, PostShip la vérifie devant vous.
        </p>
        <Link href="/#demo" className={buttonVariants({ variant: "default" })}>
          Essayer la démo
        </Link>
      </div>
    </div>
  );
}
