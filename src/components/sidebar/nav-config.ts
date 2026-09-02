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
  label: string;
  items: NavItem[];
};

export const PROJECT_NAV_GROUPS: NavGroup[] = [
  {
    label: "Surveillance",
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
    label: "Contrôles",
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
    label: "Outils",
    items: [
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

// Flattened for lookups that don't care about grouping (active-segment
// matching, the incidents badge count, etc).
export const PROJECT_NAV: NavItem[] = PROJECT_NAV_GROUPS.flatMap((g) => g.items);

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

// Top-level segments right after "/app/" that are NOT project ids.
export const RESERVED_APP_SEGMENTS = new Set(["account", "billing"]);
