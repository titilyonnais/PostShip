import Link from "next/link";
import {
  Clock,
  Globe,
  Link2,
  MessageSquare,
  ShieldCheck,
  Webhook,
} from "lucide-react";

export const metadata = {
  title: "Documentation",
};

const CHECK_TYPES = [
  {
    icon: Link2,
    title: "HTTP",
    body: "Suit jusqu'à 5 redirections, mesure le TTFB, vérifie le statut attendu (200 par défaut, configurable) et peut exiger la présence — ou l'absence — d'un texte précis dans la réponse (champs « Doit contenir » / « Ne doit pas contenir » à l'ajout d'une URL).",
  },
  {
    icon: Globe,
    title: "OG / Twitter",
    body: "Vérifie que l'image og:image répond en HEAD (200). Utile pour les pages de partage — un lien Slack ou X sans preview cassée.",
  },
  {
    icon: Globe,
    title: "Sitemap",
    body: "Parse sitemap.xml (y compris un sitemapindex, en suivant jusqu'à 3 sitemaps enfants), échantillonne jusqu'à 10 URLs et vérifie qu'elles répondent.",
  },
  {
    icon: ShieldCheck,
    title: "SSL",
    body: "Contrôle l'expiration du certificat TLS. Alertes graduées à J-30, J-7 et J-1, puis certificat expiré — une seule alerte par palier franchi, pas de spam quotidien.",
  },
  {
    icon: ShieldCheck,
    title: "Stripe health (plan Team)",
    body: "Vérifie que votre page de succès Stripe (success_url) répond en 2xx après un paiement. Ne rejoue pas d'événements webhook — c'est un contrôle HTTP simple sur l'URL de succès.",
  },
];

const INTEGRATIONS = [
  {
    icon: Webhook,
    title: "Webhook de déploiement — Vercel, Netlify, Cloudflare Pages (plans Solo et Team)",
    body: "Chaque hébergeur pointe vers sa propre URL dans Paramètres du projet → Vérification au déploiement. Vercel : Project Settings → Webhooks, événement deployment.ready. Netlify : Notifications → Deploy notifications → Outgoing webhook, événement « Deploy succeeded ». Cloudflare Pages : Notifications → Destinations → Webhooks, puis une Notification sur « Pages Deployment Success ». Dans les trois cas, un déploiement réussi déclenche une vérification immédiate, en plus du cycle automatique.",
  },
  {
    icon: MessageSquare,
    title: "Alertes Discord (plans Solo et Team)",
    body: "Dans Discord : Paramètres du salon → Intégrations → Webhooks → Nouveau webhook. Collez l'URL générée dans Paramètres du projet → Alertes Discord. Les alertes Discord viennent en complément de l'email, jamais à sa place.",
  },
];

export default function DocsPage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-16 px-6 py-16 sm:px-10">
      <div className="flex flex-col gap-3 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
        <h1 className="text-3xl font-semibold tracking-tight">Documentation</h1>
        <p className="text-sm text-muted-foreground">
          Comment PostShip vérifie votre site, et comment brancher Discord et
          Vercel.
        </p>
      </div>

      <section className="flex flex-col gap-6">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Cycle de vérification
        </h2>
        <div className="flex items-start gap-3 rounded-md border border-border bg-card p-4">
          <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">
            Free : toutes les 30 min. Solo et Team : toutes les 5 min, plus une
            vérification immédiate à chaque déploiement via le webhook Vercel.
            L&apos;heure de la dernière vérification est visible en haut de
            chaque projet dans le tableau de bord — si elle prend plus de deux
            fois l&apos;intervalle attendu, un avertissement s&apos;affiche.
          </p>
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Types de vérification
        </h2>
        <div className="flex flex-col gap-4">
          {CHECK_TYPES.map((check) => (
            <div
              key={check.title}
              className="flex items-start gap-3 rounded-md border border-border bg-card p-4"
            >
              <check.icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <div>
                <h3 className="text-sm font-medium">{check.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{check.body}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-6">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Intégrations
        </h2>
        <div className="flex flex-col gap-4">
          {INTEGRATIONS.map((integration) => (
            <div
              key={integration.title}
              className="flex items-start gap-3 rounded-md border border-border bg-card p-4"
            >
              <integration.icon
                className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <div>
                <h3 className="text-sm font-medium">{integration.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">
                  {integration.body}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Alertes
        </h2>
        <p className="text-sm text-muted-foreground">
          Un email est envoyé au premier échec détecté, puis à chaque
          rétablissement — jamais deux alertes identiques en moins de 10
          minutes. Discord reçoit la même chose en plus de l&apos;email, si
          configuré. Rien n&apos;est envoyé tant que tout est vert.
        </p>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Scan de site
        </h2>
        <p className="text-sm text-muted-foreground">
          En plus de la surveillance continue, un scan ponctuel explore votre
          sitemap (y compris un sitemapindex) puis suit les liens internes en
          largeur depuis la page de départ, jusqu&apos;à 500 pages, en
          respectant les règles Disallow de votre robots.txt. Consomme des
          tokens achetés séparément — voir{" "}
          <Link href="/pricing#tokens" className="text-foreground underline underline-offset-2">
            les tarifs
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
