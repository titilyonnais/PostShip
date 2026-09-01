import { createServiceClient } from "./db/service";

const PROVIDER_LABEL: Record<string, string> = {
  google: "Google",
  github: "GitHub",
  email: "email (mot de passe ou lien magique)",
};

// Supabase's own signUp/OTP endpoints deliberately hide whether an email is
// already registered (anti-enumeration). This bypasses that on purpose, only
// for the password-signup and email-change flows, at the user's request —
// those flows need to tell someone "this email already has a Google account"
// instead of silently no-op'ing or creating a confusing duplicate.
export async function findAccountProvidersByEmail(
  email: string,
): Promise<string[] | null> {
  const service = createServiceClient();
  const { data: profile } = await service
    .from("profiles")
    .select("id")
    .ilike("email", email)
    .maybeSingle();

  if (!profile) return null;

  const { data } = await service.auth.admin.getUserById(profile.id);
  const providers = (data.user?.identities ?? []).map(
    (identity) => PROVIDER_LABEL[identity.provider] ?? identity.provider,
  );

  return providers.length > 0 ? providers : ["un autre moyen de connexion"];
}
