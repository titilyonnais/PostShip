import { Coins } from "lucide-react";
import { SubmitButton } from "@/components/submit-button";
import { TOKEN_PACKS, type TokenPackId } from "@/lib/stripe";
import { buyTokens } from "./tokens-actions";

const TOKEN_PACK_IDS: TokenPackId[] = ["500", "1000", "5000"];

export function TokensTab({ tokenBalance }: { tokenBalance: number }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-4">
        <span className="text-xs text-muted-foreground">Solde de tokens</span>
        <span className="flex items-center gap-2 font-mono text-2xl">
          <Coins className="size-5 text-muted-foreground" aria-hidden="true" />
          {tokenBalance}
        </span>
        <span className="text-xs text-muted-foreground">
          Indépendants de votre abonnement — 1 token = 1 page scannée lors
          d&apos;un scan complet de site, disponible depuis chaque projet.
        </span>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {TOKEN_PACK_IDS.map((packId) => {
          const pack = TOKEN_PACKS[packId];
          const highlight = packId === "1000";
          return (
            <div
              key={packId}
              className={`flex flex-col gap-3 rounded-2xl border p-4 ${
                highlight ? "border-foreground/30 bg-card" : "border-border"
              }`}
            >
              <div className="flex items-center justify-between">
                <h3 className="font-mono text-lg">{pack.tokens}</h3>
                {highlight && (
                  <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                    Populaire
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                tokens — {pack.priceLabel}
              </p>
              <p className="flex-1 text-xs text-muted-foreground">
                {pack.blurb}
              </p>
              <form action={buyTokens.bind(null, packId)}>
                <SubmitButton
                  variant={highlight ? "default" : "outline"}
                  className="w-full"
                  pendingText="Redirection..."
                >
                  Acheter — {pack.priceLabel}
                </SubmitButton>
              </form>
            </div>
          );
        })}
      </div>
    </div>
  );
}
