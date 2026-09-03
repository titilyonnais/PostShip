import { redirect } from "next/navigation";
import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { SignupForm } from "./signup-form";

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  solo: "Solo",
  team: "Team",
};

export const metadata = {
  title: "Créer un compte",
};

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; plan?: string; confirm?: string }>;
}) {
  const { error, plan, confirm } = await searchParams;
  const normalizedPlan = plan && plan in PLAN_LABEL ? (plan as keyof typeof PLAN_LABEL) : null;

  // Feedback fix: "Commencer" used to jump straight to plan=free without
  // ever showing the plan comparison — now every entry into signup has to
  // go through /pricing first (its "Choisir {plan}" buttons are what set
  // ?plan=), so a bare /signup visit (typed URL, old bookmark) redirects
  // there instead of silently defaulting to Free.
  if (!normalizedPlan) {
    redirect("/pricing");
  }

  const genericErrors: Record<string, string> = {
    github: "La connexion GitHub a échoué. Réessayez.",
    google: "La connexion Google a échoué. Réessayez.",
  };
  const errorMessage = error && genericErrors[error] ? genericErrors[error] : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <Link
        href="/"
        className="self-center rounded-full px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        ← Retour à l&apos;accueil
      </Link>
      <Link href="/" className="motion-safe:animate-in motion-safe:fade-in" aria-label="PostShip, accueil">
        <LogoMark className="size-14" />
      </Link>
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-2xl border border-border bg-card p-6 shadow-[0_8px_40px_rgba(0,0,0,0.25)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
        {errorMessage && (
          <p role="alert" className="text-center text-sm text-destructive">
            {errorMessage}
          </p>
        )}
        <SignupForm
          plan={normalizedPlan}
          planLabel={PLAN_LABEL[normalizedPlan]}
          error={error && !genericErrors[error] ? error : null}
          confirm={confirm === "1"}
        />
      </div>
    </main>
  );
}
