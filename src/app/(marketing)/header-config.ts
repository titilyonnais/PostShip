import {
  AlertTriangle,
  Bell,
  CreditCard,
  Radar,
  Rocket,
  ShieldCheck,
  Webhook,
  type LucideIcon,
} from "lucide-react";

export type HeaderLink = { label: string; href: string };
export type HeaderSlot = { label: string; href: string } | null;
export type HeaderConfig = { links: HeaderLink[]; slot: HeaderSlot };

// S2b (site backlog): the 4 section links never change — only the page
// content (current page rendered non-clickable) and the right-hand slot
// vary. Kept here so the header component never hardcodes routing logic.
export const SECTION_LINKS: HeaderLink[] = [
  { label: "Produit", href: "/produit" },
  { label: "Tarifs", href: "/pricing" },
  { label: "Documentation", href: "/docs" },
  { label: "Journal", href: "/changelog" },
];

export type MegaMenuItem = { href: string; label: string; description: string; icon: LucideIcon };

// Hover mega menus for the two section links deep enough to deserve one —
// Tarifs and Journal are single pages, nothing to fan out. Produit's 4
// items anchor into that page's own #id sections (see produit/page.tsx);
// Documentation's pick one representative page per DOC_CATEGORIES
// (src/lib/docs.ts) rather than listing all 19 pages.
export const MEGA_MENUS: Record<string, MegaMenuItem[]> = {
  "/produit": [
    {
      href: "/produit#deploy",
      label: "Vérifié à la seconde où ça déploie",
      description: "Webhook Vercel/Netlify/Cloudflare + rappels T+2 et T+8.",
      icon: Webhook,
    },
    {
      href: "/produit#au-dela-200",
      label: "Plus loin qu'un simple statut 200",
      description: "JS, prix, Open Graph, sitemap, SSL, radar de mutation.",
      icon: AlertTriangle,
    },
    {
      href: "/produit#ship-score",
      label: "Un score, pas juste vert ou rouge",
      description: "Le Ship Score sur 100, avec la phrase qui l'explique.",
      icon: ShieldCheck,
    },
    {
      href: "/produit#alertes",
      label: "Alerté seulement si ça casse",
      description: "Email, Discord, Slack, Telegram — groupés, sans doublon.",
      icon: Rocket,
    },
  ],
  "/docs": [
    {
      href: "/docs/introduction",
      label: "Démarrer",
      description: "Ce que PostShip fait, en une phrase.",
      icon: Rocket,
    },
    {
      href: "/docs/http-assets",
      label: "Vérifications",
      description: "HTTP, Open Graph, sitemap, SSL, Stripe.",
      icon: ShieldCheck,
    },
    {
      href: "/docs/webhooks-deploy",
      label: "Déploiements",
      description: "Webhooks, T+2/T+8, Ship Score, radar de mutation.",
      icon: Webhook,
    },
    {
      href: "/docs/alertes-canaux",
      label: "Alertes",
      description: "Canaux, règles de confirmation, webhook sortant.",
      icon: Bell,
    },
    {
      href: "/docs/app-pages",
      label: "App",
      description: "Pages, bot, badge de partage, scans.",
      icon: Radar,
    },
    {
      href: "/docs/plans",
      label: "Compte",
      description: "Plans, limites, facturation.",
      icon: CreditCard,
    },
  ],
};

const OUVRIR_APP: HeaderSlot = { label: "Ouvrir l'app", href: "/app" };

// A slot label that gets replaced by "Ouvrir l'app" once the visitor is
// signed in — used both here and by the header to decide whether the
// separate Connexion/account link should render alongside it (never two
// controls for the same action).
export const ANONYMOUS_ONLY_SLOT_LABELS = [
  "Commencer",
  "Prendre Solo",
  "Ouvrir l'app",
] as const;

// Pure pathname (+auth) → header config mapper. No JSX, no routing
// side-effects — the header component only renders what this returns.
export function getHeaderConfig(pathname: string, isLoggedIn: boolean): HeaderConfig {
  const links = SECTION_LINKS;

  if (pathname === "/") {
    return { links, slot: isLoggedIn ? OUVRIR_APP : { label: "Commencer", href: "/login?plan=free" } };
  }
  if (pathname === "/produit") {
    return { links, slot: isLoggedIn ? OUVRIR_APP : { label: "Voir les tarifs", href: "/pricing" } };
  }
  if (pathname === "/pricing") {
    return { links, slot: isLoggedIn ? OUVRIR_APP : { label: "Prendre Solo", href: "/login?plan=solo" } };
  }
  if (pathname === "/changelog") {
    return { links, slot: isLoggedIn ? OUVRIR_APP : { label: "Voir le produit", href: "/produit" } };
  }
  if (pathname === "/docs" || pathname.startsWith("/docs/")) {
    return { links, slot: isLoggedIn ? OUVRIR_APP : { label: "Commencer", href: "/login?plan=free" } };
  }
  if (pathname === "/login") {
    // The form itself is the action — no competing CTA, no NavAuth either
    // (the header hides its auth link separately for this one route).
    return { links, slot: null };
  }
  // Legal pages, and anything else not explicitly mapped above.
  return { links, slot: { label: "Accueil", href: "/" } };
}
