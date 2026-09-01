import Link from "next/link";
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
  searchParams: Promise<{ error?: string; plan?: string }>;
}) {
  const { error, plan } = await searchParams;
  const normalizedPlan =
    plan && plan in PLAN_LABEL ? (plan as keyof typeof PLAN_LABEL) : null;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8">
      <Link href="/" className="font-mono text-sm text-foreground">
        PostShip
      </Link>
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-md border border-border p-6">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-lg font-semibold">Connexion</h1>
          {normalizedPlan && (
            <p className="text-xs text-muted-foreground">
              Plan sélectionné : {PLAN_LABEL[normalizedPlan]}
            </p>
          )}
        </div>
        {error && (
          <p role="alert" className="text-center text-sm text-destructive">
            La connexion a échoué. Réessayez.
          </p>
        )}
        <LoginForm plan={normalizedPlan} />
      </div>
    </main>
  );
}
