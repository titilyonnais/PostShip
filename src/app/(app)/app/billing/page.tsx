import { Suspense } from "react";
import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { CheckoutReturnToast } from "@/components/checkout-return-toast";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/db/server";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { PLAN_LABEL, PUBLIC_PLANS } from "@/lib/pricing";
import { openBillingPortal, startCheckout } from "./actions";

export default async function BillingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("plan, stripe_customer_id")
    .eq("id", user?.id)
    .single();

  const plan = (profile?.plan as Plan) ?? "free";
  const limits = getPlanLimits(plan);

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <Suspense fallback={null}>
        <CheckoutReturnToast />
      </Suspense>

      <div>
        <h1 className="text-lg font-semibold">Abonnement</h1>
        <p className="text-sm text-muted-foreground">
          Plan actuel : {PLAN_LABEL[plan]} — {limits.projects} projet(s),{" "}
          {limits.urls} URL(s), vérification toutes les{" "}
          {limits.intervalMinutes} min.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {PUBLIC_PLANS.map((item) => {
          const isCurrent = item.id === plan;
          return (
            <div
              key={item.id}
              className={`flex flex-col gap-3 rounded-md border p-4 transition-colors ${
                isCurrent
                  ? "border-foreground/30 bg-card"
                  : "border-border hover:border-foreground/20"
              }`}
            >
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-medium">{PLAN_LABEL[item.id]}</h2>
                {isCurrent && <Badge>Actuel</Badge>}
              </div>
              <p className="font-mono text-lg">{item.price}</p>
              <ul className="flex flex-1 flex-col gap-1.5 text-xs text-muted-foreground">
                {item.features.map((feature) => (
                  <li key={feature} className="flex items-center gap-1.5">
                    <Check
                      className="size-3 shrink-0 text-[#3fb950]"
                      aria-hidden="true"
                    />
                    {feature}
                  </li>
                ))}
              </ul>
              {item.id !== "free" && (
                <form action={startCheckout.bind(null, item.id)}>
                  <SubmitButton
                    className="w-full"
                    variant={isCurrent ? "outline" : "default"}
                    disabled={isCurrent || (item.id === "solo" && plan === "team")}
                    pendingText="Redirection..."
                  >
                    {isCurrent ? "Plan actuel" : `Passer à ${PLAN_LABEL[item.id]}`}
                  </SubmitButton>
                </form>
              )}
            </div>
          );
        })}
      </div>

      {profile?.stripe_customer_id && (
        <form action={openBillingPortal}>
          <SubmitButton variant="outline" pendingText="Redirection...">
            Gérer mon abonnement
          </SubmitButton>
        </form>
      )}
    </div>
  );
}
