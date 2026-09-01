"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { completeOnboarding, type OnboardingState } from "./actions";

const TEAM_SIZES: { value: string; label: string }[] = [
  { value: "solo", label: "Solo" },
  { value: "2-5", label: "2 à 5 personnes" },
  { value: "6-20", label: "6 à 20 personnes" },
  { value: "20+", label: "20 personnes et plus" },
];

const initialState: OnboardingState = { error: null };

export function OnboardingForm({ plan }: { plan: string | null }) {
  const boundAction = completeOnboarding.bind(null, plan);
  const [state, formAction] = useActionState(boundAction, initialState);
  const isPaidSignup = plan === "solo" || plan === "team";

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="full_name" className="text-xs text-muted-foreground">
            Nom complet <span aria-hidden="true">*</span>
          </label>
          <Input id="full_name" name="full_name" required autoFocus />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label
              htmlFor="company_name"
              className="text-xs text-muted-foreground"
            >
              Société
            </label>
            <Input id="company_name" name="company_name" placeholder="Optionnel" />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="phone" className="text-xs text-muted-foreground">
              Téléphone
            </label>
            <Input id="phone" name="phone" type="tel" placeholder="Optionnel" />
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="team_size" className="text-xs text-muted-foreground">
            Taille de l&apos;équipe
          </label>
          <select
            id="team_size"
            name="team_size"
            className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            defaultValue=""
          >
            <option value="">Non précisé</option>
            {TEAM_SIZES.map((size) => (
              <option key={size.value} value={size.value}>
                {size.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {isPaidSignup && (
        <div className="flex flex-col gap-4 rounded-md border border-border bg-card p-4">
          <div>
            <h2 className="text-sm font-medium">Adresse de facturation</h2>
            <p className="text-xs text-muted-foreground">
              Requise pour émettre les factures de votre abonnement.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="billing_line1"
              className="text-xs text-muted-foreground"
            >
              Adresse <span aria-hidden="true">*</span>
            </label>
            <Input id="billing_line1" name="billing_line1" required />
          </div>

          <div className="flex flex-col gap-1">
            <label
              htmlFor="billing_line2"
              className="text-xs text-muted-foreground"
            >
              Complément d&apos;adresse
            </label>
            <Input id="billing_line2" name="billing_line2" placeholder="Optionnel" />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <label
                htmlFor="billing_city"
                className="text-xs text-muted-foreground"
              >
                Ville <span aria-hidden="true">*</span>
              </label>
              <Input id="billing_city" name="billing_city" required />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="billing_postal_code"
                className="text-xs text-muted-foreground"
              >
                Code postal <span aria-hidden="true">*</span>
              </label>
              <Input id="billing_postal_code" name="billing_postal_code" required />
            </div>
            <div className="flex flex-col gap-1">
              <label
                htmlFor="billing_country"
                className="text-xs text-muted-foreground"
              >
                Pays (code ISO) <span aria-hidden="true">*</span>
              </label>
              <Input
                id="billing_country"
                name="billing_country"
                placeholder="FR"
                maxLength={2}
                required
              />
            </div>
          </div>
        </div>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}

      <SubmitButton pendingText={isPaidSignup ? "Redirection..." : "Enregistrement..."}>
        {isPaidSignup ? "Continuer vers le paiement" : "Accéder à mon espace"}
      </SubmitButton>
    </form>
  );
}
