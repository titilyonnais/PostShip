import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/db/server";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { DeleteAccountButton } from "./delete-account-button";
import { updateDisplayName } from "./actions";

const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  solo: "Solo",
  team: "Team",
};

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("email, display_name, plan, locale")
    .eq("id", user?.id)
    .single();

  const plan = (profile?.plan as Plan) ?? "free";

  return (
    <div className="flex flex-col gap-6">
      {error && <p className="text-sm text-destructive">{error}</p>}

      <div>
        <h1 className="text-lg font-semibold">Compte</h1>
        <p className="text-sm text-muted-foreground">
          {profile?.email ?? user?.email} — plan {PLAN_LABEL[plan]} (
          {getPlanLimits(plan).retentionDays} jours de rétention)
        </p>
      </div>

      <form action={updateDisplayName} className="flex max-w-sm gap-2">
        <Input
          name="display_name"
          defaultValue={profile?.display_name ?? ""}
          placeholder="Nom affiché (optionnel)"
        />
        <Button type="submit" variant="outline">
          Enregistrer
        </Button>
      </form>

      <div className="flex flex-col gap-2 border border-border p-4">
        <h2 className="text-sm font-medium text-muted-foreground">
          Zone dangereuse
        </h2>
        <p className="text-xs text-muted-foreground">
          Supprime définitivement votre compte, tous vos projets, targets et
          l&apos;historique des vérifications. Résilie aussi l&apos;abonnement
          Stripe actif s&apos;il y en a un.
        </p>
        <div>
          <DeleteAccountButton />
        </div>
      </div>
    </div>
  );
}
