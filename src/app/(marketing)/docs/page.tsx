import Link from "next/link";
import { BookOpen } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";

export const metadata = {
  title: "Documentation",
};

export default function DocsPage() {
  return (
    <div className="mx-auto flex min-h-[60vh] w-full max-w-2xl flex-col items-center justify-center gap-4 px-6 py-16 text-center motion-safe:animate-in motion-safe:fade-in motion-safe:duration-500">
      <BookOpen className="size-6 text-muted-foreground" aria-hidden="true" />
      <h1 className="text-2xl font-semibold tracking-tight">
        Documentation — bientôt disponible
      </h1>
      <p className="max-w-md text-sm text-muted-foreground">
        Guides de configuration, référence des types de vérification et
        exemples d&apos;intégration Discord/Vercel arrivent prochainement.
      </p>
      <Link href="/login?plan=free" className={buttonVariants({ variant: "default" })}>
        Commencer gratuitement
      </Link>
    </div>
  );
}
