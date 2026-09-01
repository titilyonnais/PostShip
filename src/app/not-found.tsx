import Link from "next/link";
import { Logo } from "@/components/logo";

export const metadata = {
  title: "Page introuvable",
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-8 text-center">
      <Logo className="h-6" />
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          404 — Page introuvable
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Cette page n&apos;existe pas ou plus.
        </p>
      </div>
      <Link
        href="/"
        className="text-sm text-foreground underline underline-offset-2"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
