import { Coins, Download } from "lucide-react";
import { avatarUrl } from "@/lib/avatar";
import { getAuthUser, getProfile } from "@/lib/db/loaders";
import { getPlanLimits, type Plan } from "@/lib/entitlements";

const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  solo: "Solo",
  team: "Team",
};

export default async function AccountOverviewPage() {
  const user = await getAuthUser();
  const profile = user ? await getProfile(user.id) : null;

  const plan = (profile?.plan as Plan) ?? "free";
  const limits = getPlanLimits(plan);
  const tokenBalance = profile?.token_balance ?? 0;
  const profileComplete = Boolean(profile?.full_name);

  return (
    <div className="flex flex-col gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Abonnement</p>
          <p className="mt-1 text-lg font-medium">{PLAN_LABEL[plan]}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {limits.projects} projet(s) · {limits.urls} URL(s)
          </p>
        </div>
        <div className="rounded-md border border-border bg-card p-4">
          <p className="text-xs text-muted-foreground">Tokens</p>
          <p className="mt-1 flex items-center gap-1.5 text-lg font-medium">
            <Coins className="size-4 text-muted-foreground" aria-hidden="true" />
            {tokenBalance}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Pour les scans complets de site
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-md border border-border bg-card p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- external DiceBear SVG */}
          <img
            src={avatarUrl(profile?.avatar_seed ?? user?.id ?? "", 64)}
            alt=""
            className="size-10 shrink-0 rounded-full bg-secondary"
            width={40}
            height={40}
          />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium">
              {profile?.username || profile?.full_name || profile?.email}
            </p>
            <p className="text-xs text-muted-foreground">
              {profileComplete ? "Profil complet" : "Profil à compléter"}
            </p>
          </div>
        </div>
      </div>

      <div className="rounded-md border border-border bg-card p-4">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Vos données
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">
          Téléchargez une copie de votre profil, vos projets et vos URLs
          surveillées au format JSON.
        </p>
        <a
          href="/api/account/export"
          className="mt-2 inline-flex items-center gap-1.5 text-xs text-foreground underline underline-offset-2"
        >
          <Download className="size-3.5" aria-hidden="true" />
          Exporter mes données
        </a>
      </div>
    </div>
  );
}
