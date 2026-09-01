import { Suspense } from "react";
import { BackToProjectLink } from "@/components/back-to-project-link";
import { CheckoutReturnToast } from "@/components/checkout-return-toast";
import { createClient } from "@/lib/db/server";
import { getPlanLimits, type Plan } from "@/lib/entitlements";

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
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const { data: profile } = await supabase
    .from("profiles")
    .select("email, plan")
    .eq("id", user?.id)
    .single();

  const plan = (profile?.plan as Plan) ?? "free";
  const limits = getPlanLimits(plan);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <Suspense fallback={null}>
        <CheckoutReturnToast />
        <BackToProjectLink />
      </Suspense>

      <div>
        <h1 className="text-lg font-semibold">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          {profile?.email ?? user?.email} — plan {PLAN_LABEL[plan]} (
          {limits.retentionDays} jours de rétention)
        </p>
      </div>

      {children}
    </div>
  );
}
