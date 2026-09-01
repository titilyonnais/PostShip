import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { createClient } from "@/lib/db/server";
import { IdentitySection } from "../identity-section";
import { TeamSizeSelect } from "../team-size-select";
import { updateDisplayName, updateProfile } from "../actions";

export const metadata = {
  title: "Profil",
};

export default async function AccountProfilePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("username, avatar_seed, display_name, full_name, company_name, phone, team_size")
    .eq("id", user?.id)
    .single();

  return (
    <div className="flex flex-col gap-6">
      <IdentitySection
        username={profile?.username ?? ""}
        avatarSeed={profile?.avatar_seed ?? user?.id ?? ""}
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
        <div className="flex flex-col gap-1">
          <label htmlFor="team_size" className="text-xs text-muted-foreground">
            Taille de l&apos;équipe
          </label>
          <TeamSizeSelect defaultValue={profile?.team_size ?? ""} />
        </div>
        <div>
          <SubmitButton pendingText="Enregistrement...">
            Enregistrer le profil
          </SubmitButton>
        </div>
      </ActionForm>
    </div>
  );
}
