import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/db/server";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { openBillingPortal, startCheckout } from "./actions";

const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  solo: "Solo — 12€ TTC / mois",
  team: "Team — 29€ TTC / mois",
};

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; checkout?: string }>;
}) {
  const { error, checkout } = await searchParams;

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
    <div className="flex flex-col gap-6">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {checkout === "success" && (
        <p role="status" className="text-sm text-[#3fb950]">
          Abonnement activé.
        </p>
      )}

      <div>
        <h1 className="text-lg font-semibold">Abonnement</h1>
        <p className="text-sm text-muted-foreground">
          Plan actuel : {PLAN_LABEL[plan]} — {limits.projects} projet(s),{" "}
          {limits.urls} URL(s), vérification toutes les{" "}
          {limits.intervalMinutes} min.
        </p>
      </div>

      <div className="flex gap-3">
        <form action={startCheckout.bind(null, "solo")}>
          <SubmitButton
            disabled={plan === "solo" || plan === "team"}
            pendingText="Redirection..."
          >
            Passer à Solo
          </SubmitButton>
        </form>
        <form action={startCheckout.bind(null, "team")}>
          <SubmitButton disabled={plan === "team"} pendingText="Redirection...">
            Passer à Team
          </SubmitButton>
        </form>
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
