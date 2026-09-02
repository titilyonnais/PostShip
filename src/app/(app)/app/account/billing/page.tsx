import Link from "next/link";
import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { getAuthUser, getProfile } from "@/lib/db/loaders";
import { type Plan } from "@/lib/entitlements";
import { PLAN_LABEL } from "@/lib/pricing";
import { updateBillingAddress } from "../actions";

export const metadata = {
  title: "Facturation",
};

type BillingAddress = {
  line1?: string;
  line2?: string | null;
  city?: string;
  postal_code?: string;
  country?: string;
} | null;

export default async function AccountBillingPage() {
  const user = await getAuthUser();
  const profile = user ? await getProfile(user.id) : null;

  const plan = (profile?.plan as Plan) ?? "free";
  const billingAddress = (profile?.billing_address as BillingAddress) ?? null;

  return (
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

      <ActionForm action={updateBillingAddress} className="flex flex-col gap-4">
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
            <label htmlFor="postal_code" className="text-xs text-muted-foreground">
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
            <label htmlFor="country" className="text-xs text-muted-foreground">
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
  );
}
