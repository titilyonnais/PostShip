import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { DEFAULT_TIMEZONE } from "@/lib/timezone";
import { BillingAddressSection, type BillingAddress } from "./billing-address-section";
import { IdentitySection } from "./identity-section";
import { TeamSizeSelect } from "./team-size-select";
import { TimezoneSelect } from "./timezone-select";
import { updateDisplayName, updateProfile } from "./actions";

export function ProfileTab({
  profile,
  billingAddress,
}: {
  billingAddress: BillingAddress;
  profile: {
    username: string | null;
    avatar_seed: string | null;
    avatar_url: string | null;
    display_name: string | null;
    full_name: string | null;
    company_name: string | null;
    phone: string | null;
    team_size: string | null;
    timezone: string | null;
  } | null;
}) {
  return (
    <div className="flex flex-col gap-6">
      <IdentitySection
        username={profile?.username ?? ""}
        avatarSeed={profile?.avatar_seed ?? ""}
        avatarUrl={profile?.avatar_url ?? null}
      />

      <ActionForm
        action={updateDisplayName}
        className="flex max-w-sm items-end gap-2"
      >
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
      </ActionForm>

      <ActionForm action={updateProfile} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="full_name" className="text-xs text-muted-foreground">
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
            <label htmlFor="company_name" className="text-xs text-muted-foreground">
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
            <label htmlFor="phone" className="text-xs text-muted-foreground">
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="team_size" className="text-xs text-muted-foreground">
              Taille de l&apos;équipe
            </label>
            <TeamSizeSelect defaultValue={profile?.team_size ?? ""} />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="timezone" className="text-xs text-muted-foreground">
              Fuseau horaire
            </label>
            <TimezoneSelect defaultValue={profile?.timezone ?? DEFAULT_TIMEZONE} />
            <p className="text-xs text-muted-foreground">
              Utilisé pour afficher les dates de vérification à votre heure.
              Détecté automatiquement depuis votre navigateur, modifiable ici.
            </p>
          </div>
        </div>
        <div>
          <SubmitButton pendingText="Enregistrement...">
            Enregistrer le profil
          </SubmitButton>
        </div>
      </ActionForm>
      <BillingAddressSection billingAddress={billingAddress} />
    </div>
  );
}
