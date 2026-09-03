import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Bell,
  Blocks,
  CreditCard,
  Gauge,
  HeartPulse,
  LayoutDashboard,
  Link2,
  Receipt,
  Rocket,
  ScanSearch,
  Settings,
  Share2,
  ShieldCheck,
  Siren,
  Coins,
  User,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: (projectId: string) => string;
  icon: LucideIcon;
  // Which path segment after the project id this item owns — undefined
  // means it owns the project root itself (no third segment).
  segment?: string;
};

// V1 (ia-moderne backlog): flat, always-visible project nav — Vercel's
// model, not a drill-down. Top-level items first, then a labelled
// "Observabilité" group (a section label, not a link), then a divider,
// then Intégrations/Paramètres. Règles and Bot are no longer sidebar
// items — they're tabs under Paramètres (see settings/page.tsx).
export const PROJECT_NAV_TOP: NavItem[] = [
  { label: "Aperçu", href: (id) => `/app/${id}`, icon: LayoutDashboard },
  { label: "Déplois", href: (id) => `/app/${id}/deploys`, icon: Rocket, segment: "deploys" },
  { label: "Incidents", href: (id) => `/app/${id}/incidents`, icon: Siren, segment: "incidents" },
  { label: "URLs", href: (id) => `/app/${id}/urls`, icon: Link2, segment: "urls" },
];

export const PROJECT_NAV_OBSERVABILITE: { label: string; items: NavItem[] } = {
  label: "Observabilité",
  items: [
    { label: "Santé", href: (id) => `/app/${id}/health`, icon: HeartPulse, segment: "health" },
    { label: "Partage", href: (id) => `/app/${id}/share`, icon: Share2, segment: "share" },
    { label: "Scans", href: (id) => `/app/${id}/scans`, icon: ScanSearch, segment: "scans" },
  ],
};

export const PROJECT_NAV_BOTTOM: NavItem[] = [
  {
    label: "Intégrations",
    href: (id) => `/app/${id}/integrations`,
    icon: Blocks,
    segment: "integrations",
  },
  {
    label: "Paramètres",
    href: (id) => `/app/${id}/settings`,
    icon: Settings,
    segment: "settings",
  },
];

// Flattened for lookups that don't care about grouping (the incidents
// badge count, active-link matching).
export const PROJECT_NAV: NavItem[] = [
  ...PROJECT_NAV_TOP,
  ...PROJECT_NAV_OBSERVABILITE.items,
  ...PROJECT_NAV_BOTTOM,
];

export type AccountNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

// V1: the footer user dropdown, not the project sidebar — Compte,
// Facturation and Zone dangereuse live here now (Vercel keeps account
// nav out of the project nav entirely; Zone dangereuse rendered
// separately below, same as the account page's own tabs).
export const ACCOUNT_MENU_ITEMS: AccountNavItem[] = [
  { label: "Compte", href: "/app/account", icon: Gauge },
  { label: "Facturation", href: "/app/billing", icon: CreditCard },
];

export const ACCOUNT_DANGER_ITEM: AccountNavItem = {
  label: "Zone dangereuse",
  href: "/app/account?tab=danger",
  icon: AlertTriangle,
};

export type AccountTabSlug =
  | "overview"
  | "profile"
  | "security"
  | "notifications"
  | "tokens"
  | "billing"
  | "danger";

export type AccountTabItem = { label: string; tab: AccountTabSlug; icon: LucideIcon };

// Tabs for the /app/account hub (account/page.tsx + account-tabs.tsx) —
// a single ?tab= page switched client-side, same instant pattern as the
// project Paramètres hub (settings/settings-tabs.tsx), not real routes
// any more. /app/billing ("Abonnement") is a sibling route outside this
// hub, so it isn't included — it's reached from the footer dropdown.
export const ACCOUNT_TABS: AccountTabItem[] = [
  { label: "Vue d'ensemble", tab: "overview", icon: Gauge },
  { label: "Profil", tab: "profile", icon: User },
  { label: "Sécurité", tab: "security", icon: ShieldCheck },
  { label: "Notifications", tab: "notifications", icon: Bell },
  { label: "Tokens", tab: "tokens", icon: Coins },
  { label: "Factures", tab: "billing", icon: Receipt },
  { label: "Zone dangereuse", tab: "danger", icon: AlertTriangle },
];

// Top-level segments right after "/app/" that are NOT project ids.
export const RESERVED_APP_SEGMENTS = new Set(["account", "billing"]);
