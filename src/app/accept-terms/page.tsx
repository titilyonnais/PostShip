import { redirect } from "next/navigation";
import { LogoMark } from "@/components/logo";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/db/server";
import { acceptTerms } from "./actions";

export const metadata = {
  title: "Conditions d'utilisation",
};

export default async function AcceptTermsPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-8 p-8">
      <LogoMark className="size-14" />
      <div className="flex w-full max-w-sm flex-col gap-6 rounded-lg border border-border bg-card p-6 shadow-[0_8px_40px_rgba(0,0,0,0.25)]">
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-lg font-semibold">Avant de continuer</h1>
          <p className="text-xs text-muted-foreground">
            Nos conditions ont évolué depuis votre inscription — merci de les
            relire.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-center text-sm text-destructive">
            {error}
          </p>
        )}

        <form action={acceptTerms} className="flex flex-col gap-3">
          <label className="flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              name="terms_accepted"
              required
              className="mt-0.5 size-3.5 rounded border-input accent-foreground"
            />
            <span>
              J&apos;accepte les{" "}
              <a
                href="/terms"
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline underline-offset-2"
              >
                CGU
              </a>{" "}
              et la{" "}
              <a
                href="/privacy"
                target="_blank"
                rel="noreferrer"
                className="text-foreground underline underline-offset-2"
              >
                politique de confidentialité
              </a>
              .
            </span>
          </label>
          <Button type="submit">Continuer</Button>
        </form>
      </div>
    </main>
  );
}
