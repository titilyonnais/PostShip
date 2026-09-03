import { CreditCard, Globe, Image as ImageIcon, Map, ShieldCheck } from "lucide-react";

export const TARGET_KIND_LABEL: Record<string, string> = {
  http: "HTTP",
  og: "OG / Twitter",
  sitemap: "Sitemap",
  ssl: "SSL",
  stripe_health: "Stripe health",
};

const TARGET_KIND_ICON: Record<string, typeof Globe> = {
  http: Globe,
  og: ImageIcon,
  sitemap: Map,
  ssl: ShieldCheck,
  stripe_health: CreditCard,
};

export function TargetKindBadge({ kind, className = "size-8" }: { kind: string; className?: string }) {
  const Icon = TARGET_KIND_ICON[kind] ?? Globe;
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-xl bg-brand-2/10 text-brand-2 ${className}`}
    >
      <Icon className="size-4" aria-hidden="true" />
    </span>
  );
}
