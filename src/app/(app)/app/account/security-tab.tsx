import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { ConnectedAccounts, type LinkedIdentity } from "./connected-accounts";
import { EmailSection } from "./email-section";
import { MfaSection, type TotpFactor } from "./mfa-section";
import { setPassword } from "./actions";

export function SecurityTab({
  email,
  identities,
  totpFactors,
}: {
  email: string;
  identities: LinkedIdentity[];
  totpFactors: TotpFactor[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <ConnectedAccounts identities={identities} />

      <EmailSection currentEmail={email} />

      <div className="flex flex-col gap-2 border-t border-border pt-6">
        <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
          Mot de passe
        </h2>
        <p className="text-xs text-muted-foreground">
          Définissez ou changez le mot de passe utilisé pour vous connecter
          sans lien magique ni Google/GitHub.
        </p>
        <ActionForm action={setPassword} className="flex max-w-sm gap-2">
          <label htmlFor="new-password" className="sr-only">
            Nouveau mot de passe
          </label>
          <Input
            id="new-password"
            name="password"
            type="password"
            placeholder="8 caractères minimum"
            minLength={8}
            autoComplete="new-password"
            className="flex-1"
            required
          />
          <SubmitButton variant="outline" pendingText="...">
            Définir
          </SubmitButton>
        </ActionForm>
      </div>

      <div className="border-t border-border pt-6">
        <MfaSection factors={totpFactors} />
      </div>
    </div>
  );
}
