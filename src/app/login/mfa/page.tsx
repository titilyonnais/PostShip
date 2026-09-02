import { redirect } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { createClient } from "@/lib/db/server";
import { MfaChallengeForm } from "./mfa-challenge-form";

export const metadata = {
  title: "Vérification en deux étapes",
};

export default async function LoginMfaPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (!aal || aal.nextLevel !== "aal2" || aal.currentLevel === aal.nextLevel) {
    redirect("/app");
  }

  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const factorId = factorsData?.totp?.[0]?.id;
  if (!factorId) redirect("/app");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <LogoMark className="size-14" />
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-lg border border-border bg-card p-6 shadow-[0_8px_40px_rgba(0,0,0,0.25)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-lg font-semibold">Vérification en deux étapes</h1>
          <p className="text-xs text-muted-foreground">
            Entrez le code à 6 chiffres de votre application
            d&apos;authentification.
          </p>
        </div>
        <MfaChallengeForm factorId={factorId} />
      </div>
    </main>
  );
}
