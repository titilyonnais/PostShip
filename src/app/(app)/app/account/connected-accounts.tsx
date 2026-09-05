import Link from "next/link";
import { GitBranch, Link2, Mail } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { unlinkProvider } from "./identity-link-actions";

export type LinkedIdentity = {
  provider: string;
  email: string | null;
  createdAt: string | null;
};

const PROVIDERS: {
  id: string;
  label: string;
  icon: typeof GitBranch;
  hint: string;
}[] = [
  {
    id: "github",
    label: "GitHub",
    icon: GitBranch,
    hint: "Se connecter en un clic avec votre compte GitHub.",
  },
  {
    id: "google",
    label: "Google",
    // lucide has no Google mark; Mail reads as "compte Google" well enough
    // next to the label, and avoids shipping a brand SVG we'd have to
    // maintain.
    icon: Mail,
    hint: "Se connecter en un clic avec votre compte Google.",
  },
];

// Was a row of decorative pills: it told you GitHub was connected and gave
// you no way to disconnect it, and no way to add Google. Every provider is
// listed now, linked or not, with the one action that applies to it.
export function ConnectedAccounts({ identities }: { identities: LinkedIdentity[] }) {
  const byProvider = new Map(identities.map((i) => [i.provider, i]));
  const signInMethods = identities.length;

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Comptes connectés
      </h2>
      <p className="text-xs text-muted-foreground">
        Chaque compte lié est un moyen de vous connecter. Vous ne pouvez pas
        retirer le dernier.
      </p>

      <ul className="flex flex-col gap-2">
        {PROVIDERS.map(({ id, label, icon: Icon, hint }) => {
          const linked = byProvider.get(id);

          return (
            <li
              key={id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3"
            >
              <span className="flex min-w-0 items-center gap-3">
                <Icon className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="flex min-w-0 flex-col">
                  <span className="text-sm font-medium">{label}</span>
                  <span className="truncate text-xs text-muted-foreground">
                    {linked ? (linked.email ?? "Compte lié") : hint}
                  </span>
                </span>
              </span>

              {linked ? (
                <ActionForm action={unlinkProvider.bind(null, id)}>
                  <SubmitButton
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground"
                    pendingText="..."
                    disabled={signInMethods <= 1}
                  >
                    Délier
                  </SubmitButton>
                </ActionForm>
              ) : (
                <Link
                  href={`/api/account/link/${id}`}
                  className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs transition-colors hover:border-foreground/25 hover:text-foreground"
                >
                  <Link2 className="size-3" aria-hidden="true" />
                  Lier
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
