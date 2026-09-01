import { AlertTriangle } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
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
  searchParams: Promise<{ error?: string; success?: string }>;
}) {
  const { error, success } = await searchParams;

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
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="text-sm text-[#3fb950]">
          {success}
        </p>
      )}

      <div>
        <h1 className="text-lg font-semibold">Compte</h1>
        <p className="text-sm text-muted-foreground">
          {profile?.email ?? user?.email} — plan {PLAN_LABEL[plan]} (
          {getPlanLimits(plan).retentionDays} jours de rétention)
        </p>
      </div>

      <form action={updateDisplayName} className="flex max-w-sm items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="display-name" className="text-xs text-muted-foreground">
            Nom affiché
          </label>
          <Input
            id="display-name"
            name="display_name"
            defaultValue={profile?.display_name ?? ""}
            placeholder="Optionnel"
          />
        </div>
        <SubmitButton variant="outline" pendingText="Enregistrement...">
          Enregistrer
        </SubmitButton>
      </form>

      <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4">
        <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-destructive uppercase">
          <AlertTriangle className="size-3.5" aria-hidden="true" />
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
