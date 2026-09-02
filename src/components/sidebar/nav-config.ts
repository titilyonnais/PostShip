import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Bell,
  Blocks,
  Bot,
  CreditCard,
  Gauge,
  HeartPulse,
  LayoutDashboard,
  Link2,
  ListChecks,
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

export type NavGroup = {
  id: string;
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

export const PROJECT_NAV_GROUPS: NavGroup[] = [
  {
    id: "surveillance",
    label: "Surveillance",
    icon: LayoutDashboard,
    items: [
      { label: "Aperçu", href: (id) => `/app/${id}`, icon: LayoutDashboard },
      { label: "URLs", href: (id) => `/app/${id}/urls`, icon: Link2, segment: "urls" },
      {
        label: "Incidents",
        href: (id) => `/app/${id}/incidents`,
        icon: Siren,
        segment: "incidents",
      },
      {
        label: "Déplois",
        href: (id) => `/app/${id}/deploys`,
        icon: Rocket,
        segment: "deploys",
      },
    ],
  },
  {
    id: "controles",
    label: "Contrôles",
    icon: HeartPulse,
    items: [
      {
        label: "Santé",
        href: (id) => `/app/${id}/health`,
        icon: HeartPulse,
        segment: "health",
      },
      {
        label: "Partage",
        href: (id) => `/app/${id}/share`,
        icon: Share2,
        segment: "share",
      },
      {
        label: "Scans",
        href: (id) => `/app/${id}/scans`,
        icon: ScanSearch,
        segment: "scans",
      },
    ],
  },
  {
    id: "outils",
    label: "Outils",
    icon: Blocks,
    items: [
      {
        label: "Règles",
        href: (id) => `/app/${id}/rules`,
        icon: ListChecks,
        segment: "rules",
      },
      { label: "Bot", href: (id) => `/app/${id}/bot`, icon: Bot, segment: "bot" },
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
    ],
  },
];

// Flattened for lookups that don't care about grouping (the incidents
// badge count, etc).
export const PROJECT_NAV: NavItem[] = PROJECT_NAV_GROUPS.flatMap((g) => g.items);

// Which drill-down group owns a given project sub-route segment.
// `undefined` segment is the project root (Aperçu). Any segment that
// doesn't match a known item (e.g. a target-detail id under /urls, or a
// scan-detail id under /scans — the id itself never equals a nav
// segment) falls back to Surveillance, since that's always where a
// drill-in-deeper page like that was reached from.
export function groupIdForProjectSegment(segment: string | undefined): string {
  for (const group of PROJECT_NAV_GROUPS) {
    for (const item of group.items) {
      if (item.segment ? item.segment === segment : segment === undefined) {
        return group.id;
      }
    }
  }
  return "surveillance";
}

export type AccountNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export type AccountNavGroup = {
  label: string;
  items: AccountNavItem[];
};

export const ACCOUNT_NAV_GROUPS: AccountNavGroup[] = [
  {
    label: "Compte",
    items: [
      { label: "Vue d'ensemble", href: "/app/account", icon: Gauge },
      { label: "Profil", href: "/app/account/profile", icon: User },
      { label: "Sécurité", href: "/app/account/security", icon: ShieldCheck },
      { label: "Notifications", href: "/app/account/notifications", icon: Bell },
    ],
  },
  {
    label: "Facturation",
    items: [
      { label: "Tokens", href: "/app/account/tokens", icon: Coins },
      { label: "Factures", href: "/app/account/billing", icon: Receipt },
      { label: "Abonnement", href: "/app/billing", icon: CreditCard },
    ],
  },
];

// Rendered on its own, below the groups — never inside one, so it can't
// get lost in the middle of the account menu.
export const ACCOUNT_DANGER_ITEM: AccountNavItem = {
  label: "Zone dangereuse",
  href: "/app/account/danger",
  icon: AlertTriangle,
};

// Flattened for lookups that don't care about grouping (active-link
// matching).
export const ACCOUNT_NAV: AccountNavItem[] = [
  ...ACCOUNT_NAV_GROUPS.flatMap((g) => g.items),
  ACCOUNT_DANGER_ITEM,
];

// The drill-down's 4th level-0 category, alongside the 3 project groups
// (D1-D4, drill-nav backlog) — same shape as a NavGroup's identity fields
// so the sidebar can render all 4 category rows uniformly.
export const ACCOUNT_DRILL_CATEGORY = {
  id: "compte",
  label: "Compte",
  icon: Gauge,
  href: "/app/account",
};

// Top-level segments right after "/app/" that are NOT project ids.
export const RESERVED_APP_SEGMENTS = new Set(["account", "billing"]);
