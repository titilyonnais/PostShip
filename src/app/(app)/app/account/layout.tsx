import { Suspense } from "react";
import { BackToProjectLink } from "@/components/back-to-project-link";
import { CheckoutReturnToast } from "@/components/checkout-return-toast";
import { getAuthUser, getProfile } from "@/lib/db/loaders";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { AccountTabs } from "./account-tabs";

const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  solo: "Solo",
  team: "Team",
};

export default async function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  const profile = user ? await getProfile(user.id) : null;

  const plan = (profile?.plan as Plan) ?? "free";
  const limits = getPlanLimits(plan);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <Suspense fallback={null}>
        <CheckoutReturnToast />
        <BackToProjectLink />
      </Suspense>

      <div>
        <h1 className="text-lg font-semibold tracking-tight">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          {profile?.email ?? user?.email} — plan {PLAN_LABEL[plan]} (
          {limits.retentionDays} jours de rétention)
        </p>
      </div>

      <AccountTabs />

      {children}
    </div>
  );
}
