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

// Feedback fix: previously any anonymous CTA slot ("Commencer", "Prendre
// Solo") also hid the separate "Connexion" link, on the theory that they
// competed — they don't, Connexion is for a *returning* visitor and the
// CTA is for a new one, so hiding it made login impossible from the header
// on some pages (/, /pricing, /docs) while leaving it visible on others
// (/produit, /changelog). The header now shows Connexion for every logged-
// out visitor on every marketing page; only OUVRIR_APP (a real duplicate
// of the auth link once logged in) still suppresses it — see
// marketing-header.tsx's showAuthLink.
//
// Also: every CTA that meant "create an account" used to jump straight to
// /login?plan=free without ever showing the plan comparison — they now
// point at /pricing, whose own "Choisir {plan}" buttons carry the visitor
// into /signup?plan=X with an explicit choice already made.
export function getHeaderConfig(pathname: string, isLoggedIn: boolean): HeaderConfig {
  const links = SECTION_LINKS;

  if (pathname === "/") {
    return { links, slot: isLoggedIn ? OUVRIR_APP : { label: "Commencer", href: "/pricing" } };
  }
  if (pathname === "/produit") {
    return { links, slot: isLoggedIn ? OUVRIR_APP : { label: "Voir les tarifs", href: "/pricing" } };
  }
  if (pathname === "/pricing") {
    // The page itself is the plan picker — no separate CTA needed here.
    return { links, slot: isLoggedIn ? OUVRIR_APP : null };
  }
  if (pathname === "/changelog") {
    return { links, slot: isLoggedIn ? OUVRIR_APP : { label: "Voir le produit", href: "/produit" } };
  }
  if (pathname === "/docs" || pathname.startsWith("/docs/")) {
    return { links, slot: isLoggedIn ? OUVRIR_APP : { label: "Commencer", href: "/pricing" } };
  }
  if (pathname === "/login" || pathname === "/signup") {
    // The form itself is the action — no competing CTA, no separate
    // Connexion link either (the header hides it for these two routes).
    return { links, slot: null };
  }
  // Legal pages, and anything else not explicitly mapped above.
  return { links, slot: { label: "Accueil", href: "/" } };
}
