import { redirect } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { createClient } from "@/lib/db/server";
import { OnboardingForm } from "./onboarding-form";

const PLAN_LABEL: Record<string, string> = {
  solo: "Solo (12€ TTC / mois)",
  team: "Team (29€ TTC / mois)",
};

export const metadata = {
  title: "Compléter mon profil",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ plan?: string }>;
}) {
  const { plan } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", user.id)
    .single();

  if (profile?.full_name) redirect("/app");

  const normalizedPlan = plan === "solo" || plan === "team" ? plan : null;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-lg flex-col justify-center gap-6 px-6 py-16">
      <div className="flex flex-col gap-1">
        <LogoMark className="size-12" />
        <h1 className="text-lg font-semibold">Bienvenue — dernière étape</h1>
        <p className="text-sm text-muted-foreground">
          {normalizedPlan
            ? `Complétez votre profil pour activer le plan ${PLAN_LABEL[normalizedPlan]}.`
            : "Complétez votre profil pour accéder à votre espace."}
        </p>
      </div>
      <OnboardingForm plan={normalizedPlan} />
    </main>
  );
}
