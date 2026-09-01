import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/db/server";
import { getAuthUser, getProfile } from "@/lib/db/loaders";
import { EmailSection } from "../email-section";
import { MfaSection } from "../mfa-section";
import { setPassword } from "../actions";

export const metadata = {
  title: "Sécurité",
};

export default async function AccountSecurityPage() {
  const supabase = await createClient();
  const [user, { data: factorsData }] = await Promise.all([
    getAuthUser(),
    supabase.auth.mfa.listFactors(),
  ]);

  const profile = user ? await getProfile(user.id) : null;
  const totpFactor = factorsData?.totp?.[0] ?? null;

  return (
    <div className="flex flex-col gap-6">
      <EmailSection currentEmail={profile?.email ?? user?.email ?? ""} />

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
        <MfaSection
          enabled={Boolean(totpFactor)}
          factorId={totpFactor?.id ?? null}
        />
      </div>
    </div>
  );
}
