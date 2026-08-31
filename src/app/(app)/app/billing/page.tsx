import { Button } from "@/components/ui/button";
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
      {error && <p className="text-sm text-destructive">{error}</p>}
      {checkout === "success" && (
        <p className="text-sm text-emerald-500">Abonnement activé.</p>
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
          <Button type="submit" disabled={plan === "solo" || plan === "team"}>
            Passer à Solo
          </Button>
        </form>
        <form action={startCheckout.bind(null, "team")}>
          <Button type="submit" disabled={plan === "team"}>
            Passer à Team
          </Button>
        </form>
      </div>

      {profile?.stripe_customer_id && (
        <form action={openBillingPortal}>
          <Button type="submit" variant="outline">
            Gérer mon abonnement
          </Button>
        </form>
      )}
    </div>
  );
}
