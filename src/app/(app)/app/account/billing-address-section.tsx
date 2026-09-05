import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { updateBillingAddress } from "./actions";

export type BillingAddress = {
  line1?: string;
  line2?: string | null;
  city?: string;
  postal_code?: string;
  country?: string;
} | null;

// Lives in Profil rather than Facturation: it is who you are, not what you
// paid. Facturation now answers the questions that tab is actually opened
// for — what did I pay, did it go through, where is the receipt.
export function BillingAddressSection({
  billingAddress,
}: {
  billingAddress: BillingAddress;
}) {
  return (
    <div className="flex flex-col gap-3 border-t border-border pt-6">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Adresse de facturation
      </h2>
      <p className="text-xs text-muted-foreground">
        Utilisée sur vos factures. Stripe la redemande au moment du paiement —
        inutile de la renseigner avant d&apos;acheter.
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
