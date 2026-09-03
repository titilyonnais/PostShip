import Link from "next/link";
import { LogoMark } from "@/components/logo";
import { LoginForm } from "./login-form";

const PLAN_LABEL: Record<string, string> = {
  free: "Free",
  solo: "Solo",
  team: "Team",
};

export const metadata = {
  title: "Connexion",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{
    error?: string;
    plan?: string;
    mode?: string;
    confirm?: string;
  }>;
}) {
  const { error, plan, mode, confirm } = await searchParams;
  const normalizedPlan =
    plan && plan in PLAN_LABEL ? (plan as keyof typeof PLAN_LABEL) : null;

  const genericErrors: Record<string, string> = {
    github: "La connexion GitHub a échoué. Réessayez.",
    google: "La connexion Google a échoué. Réessayez.",
  };
  const errorMessage = error ? (genericErrors[error] ?? error) : null;

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
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-lg border border-border bg-card p-6 shadow-[0_8px_40px_rgba(0,0,0,0.25)] motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-500">
        {errorMessage && (
          <p role="alert" className="text-center text-sm text-destructive">
            {errorMessage}
          </p>
        )}
        <LoginForm
          plan={normalizedPlan}
          planLabel={normalizedPlan ? PLAN_LABEL[normalizedPlan] : null}
          mode={mode ?? null}
          error={mode && error && !genericErrors[error] ? error : null}
          confirm={confirm === "1"}
        />
      </div>
    </main>
  );
}
