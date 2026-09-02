import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Bell,
  Bot,
  CreditCard,
  Gauge,
  HeartPulse,
  LayoutDashboard,
  Receipt,
  Rocket,
  ScanSearch,
  Settings,
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

export const PROJECT_NAV: NavItem[] = [
  {
    label: "Aperçu",
    href: (id) => `/app/${id}`,
    icon: LayoutDashboard,
  },
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
  {
    label: "Bot",
    href: (id) => `/app/${id}/bot`,
    icon: Bot,
    segment: "bot",
  },
  {
    label: "Santé",
    href: (id) => `/app/${id}/health`,
    icon: HeartPulse,
    segment: "health",
  },
  {
    label: "Scans",
    href: (id) => `/app/${id}/scans`,
    icon: ScanSearch,
    segment: "scans",
  },
  {
    label: "Paramètres",
    href: (id) => `/app/${id}/settings`,
    icon: Settings,
    segment: "settings",
  },
];

export type AccountNavItem = {
  label: string;
  href: string;
  icon: LucideIcon;
};

export const ACCOUNT_NAV: AccountNavItem[] = [
  { label: "Vue d'ensemble", href: "/app/account", icon: Gauge },
  { label: "Profil", href: "/app/account/profile", icon: User },
  { label: "Sécurité", href: "/app/account/security", icon: ShieldCheck },
  { label: "Notifications", href: "/app/account/notifications", icon: Bell },
  { label: "Tokens", href: "/app/account/tokens", icon: Coins },
  { label: "Facturation", href: "/app/account/billing", icon: Receipt },
  { label: "Abonnement", href: "/app/billing", icon: CreditCard },
  { label: "Zone dangereuse", href: "/app/account/danger", icon: AlertTriangle },
];

// Top-level segments right after "/app/" that are NOT project ids.
export const RESERVED_APP_SEGMENTS = new Set(["account", "billing"]);
