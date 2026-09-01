import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, Coins } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { CheckoutReturnToast } from "@/components/checkout-return-toast";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/db/server";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { TOKENS_PER_PACK } from "@/lib/stripe";
import { AccountTabs } from "./account-tabs";
import { DeleteAccountButton } from "./delete-account-button";
import {
  updateBillingAddress,
  updateDisplayName,
  updateNotificationPrefs,
  updateProfile,
} from "./actions";
import { buyTokens } from "./tokens-actions";

const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  solo: "Solo",
  team: "Team",
};

const TEAM_SIZES: { value: string; label: string }[] = [
  { value: "solo", label: "Solo" },
  { value: "2-5", label: "2 à 5 personnes" },
  { value: "6-20", label: "6 à 20 personnes" },
  { value: "20+", label: "20 personnes et plus" },
];

const selectClassName =
  "h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

type BillingAddress = {
  line1?: string;
  line2?: string | null;
  city?: string;
  postal_code?: string;
  country?: string;
} | null;

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "email, display_name, full_name, company_name, phone, team_size, plan, billing_address, stripe_customer_id, email_alerts_enabled, locale, token_balance",
    )
    .eq("id", user?.id)
    .single();

  const plan = (profile?.plan as Plan) ?? "free";
  const billingAddress = (profile?.billing_address as BillingAddress) ?? null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <Suspense fallback={null}>
        <CheckoutReturnToast />
      </Suspense>

      <div>
        <h1 className="text-lg font-semibold">Compte</h1>
        <p className="text-sm text-muted-foreground">
          {profile?.email ?? user?.email} — plan {PLAN_LABEL[plan]} (
          {getPlanLimits(plan).retentionDays} jours de rétention)
        </p>
      </div>

      <AccountTabs
        profile={
          <div className="flex flex-col gap-6">
            <ActionForm
              action={updateDisplayName}
              className="flex max-w-sm items-end gap-2"
            >
              <div className="flex flex-1 flex-col gap-1">
                <label
                  htmlFor="display-name"
                  className="text-xs text-muted-foreground"
                >
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
            </ActionForm>

            <ActionForm action={updateProfile} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="full_name"
                  className="text-xs text-muted-foreground"
                >
                  Nom complet <span aria-hidden="true">*</span>
                </label>
                <Input
                  id="full_name"
                  name="full_name"
                  defaultValue={profile?.full_name ?? ""}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="company_name"
                    className="text-xs text-muted-foreground"
                  >
                    Société
                  </label>
                  <Input
                    id="company_name"
                    name="company_name"
                    defaultValue={profile?.company_name ?? ""}
                    placeholder="Optionnel"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="phone"
                    className="text-xs text-muted-foreground"
                  >
                    Téléphone
                  </label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    defaultValue={profile?.phone ?? ""}
                    placeholder="Optionnel"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="team_size"
                  className="text-xs text-muted-foreground"
                >
                  Taille de l&apos;équipe
                </label>
                <select
                  id="team_size"
                  name="team_size"
                  defaultValue={profile?.team_size ?? ""}
                  className={selectClassName}
                >
                  <option value="">Non précisé</option>
                  {TEAM_SIZES.map((size) => (
                    <option key={size.value} value={size.value}>
                      {size.label}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <SubmitButton pendingText="Enregistrement...">
                  Enregistrer le profil
                </SubmitButton>
              </div>
            </ActionForm>
          </div>
        }
        billing={
          <div className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground">
              Plan actuel : {PLAN_LABEL[plan]}.{" "}
              <Link
                href="/app/billing"
                className="text-foreground underline underline-offset-2"
              >
                Gérer l&apos;abonnement
              </Link>
            </p>

            <ActionForm
              action={updateBillingAddress}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1">
                <label htmlFor="line1" className="text-xs text-muted-foreground">
                  Adresse <span aria-hidden="true">*</span>
                </label>
                <Input
                  id="line1"
                  name="line1"
                  defaultValue={billingAddress?.line1 ?? ""}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="line2" className="text-xs text-muted-foreground">
                  Complément d&apos;adresse
                </label>
                <Input
                  id="line2"
                  name="line2"
                  defaultValue={billingAddress?.line2 ?? ""}
                  placeholder="Optionnel"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="city" className="text-xs text-muted-foreground">
                    Ville <span aria-hidden="true">*</span>
                  </label>
                  <Input
                    id="city"
                    name="city"
                    defaultValue={billingAddress?.city ?? ""}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="postal_code"
                    className="text-xs text-muted-foreground"
                  >
                    Code postal <span aria-hidden="true">*</span>
                  </label>
                  <Input
                    id="postal_code"
                    name="postal_code"
                    defaultValue={billingAddress?.postal_code ?? ""}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="country"
                    className="text-xs text-muted-foreground"
                  >
                    Pays (code ISO) <span aria-hidden="true">*</span>
                  </label>
                  <Input
                    id="country"
                    name="country"
                    defaultValue={billingAddress?.country ?? ""}
                    placeholder="FR"
                    maxLength={2}
                    required
                  />
                </div>
              </div>
              <div>
                <SubmitButton pendingText="Enregistrement...">
                  Enregistrer l&apos;adresse
                </SubmitButton>
              </div>
            </ActionForm>
          </div>
        }
        notifications={
          <ActionForm
            action={updateNotificationPrefs}
            className="flex flex-col gap-5"
          >
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="email_alerts_enabled"
                defaultChecked={profile?.email_alerts_enabled ?? true}
                className="mt-0.5 size-3.5 rounded border-input accent-foreground"
              />
              <span>
                Recevoir les alertes par email
                <span className="block text-xs text-muted-foreground">
                  Discord (si configuré par projet) n&apos;est pas affecté par
                  ce réglage.
                </span>
              </span>
            </label>

            <div className="flex max-w-[10rem] flex-col gap-1">
              <label htmlFor="locale" className="text-xs text-muted-foreground">
                Langue de l&apos;interface
              </label>
              <select
                id="locale"
                name="locale"
                defaultValue={profile?.locale ?? "fr"}
                className={selectClassName}
              >
                <option value="fr">Français</option>
                <option value="en">English</option>
              </select>
            </div>

            <div>
              <SubmitButton pendingText="Enregistrement...">
                Enregistrer les préférences
              </SubmitButton>
            </div>
          </ActionForm>
        }
        tokens={
          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1 rounded-md border border-border bg-card p-4">
              <span className="text-xs text-muted-foreground">
                Solde de tokens
              </span>
              <span className="flex items-center gap-2 font-mono text-2xl">
                <Coins className="size-5 text-muted-foreground" aria-hidden="true" />
                {profile?.token_balance ?? 0}
              </span>
            </div>
            <p className="max-w-md text-xs text-muted-foreground">
              Les tokens sont indépendants de votre abonnement — ils servent à
              lancer un scan complet d&apos;un site (1 token = 1 page
              scannée), disponible depuis chaque projet.
            </p>
            <form action={buyTokens}>
              <SubmitButton pendingText="Redirection...">
                Acheter {TOKENS_PER_PACK} tokens — 5€
              </SubmitButton>
            </form>
          </div>
        }
        danger={
          <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4">
            <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-destructive uppercase">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              Zone dangereuse
            </h2>
            <p className="text-xs text-muted-foreground">
              Supprime définitivement votre compte, tous vos projets, targets
              et l&apos;historique des vérifications. Résilie aussi
              l&apos;abonnement Stripe actif s&apos;il y en a un.
            </p>
            <div>
              <DeleteAccountButton />
            </div>
          </div>
        }
      />
    </div>
  );
}
