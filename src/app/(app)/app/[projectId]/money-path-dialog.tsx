"use client";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { useToastAction } from "@/lib/use-toast-action";
import { addMoneyPathPreset } from "./actions";

export function MoneyPathDialog({
  projectId,
  baseUrl,
}: {
  projectId: string;
  baseUrl: string;
}) {
  const { formAction, pending } = useToastAction(
    addMoneyPathPreset.bind(null, projectId),
  );

  return (
    <Dialog>
      <DialogTrigger render={<Button type="button" variant="outline" />}>
        Ajouter le pack argent
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Pack argent</DialogTitle>
          <DialogDescription>
            Ajoute d&apos;un coup les URLs qui font perdre de l&apos;argent si
            elles cassent : accueil, tarifs, connexion, et optionnellement
            checkout — avec des vérifications concrètes (prix toujours
            affiché, formulaire de connexion présent, Stripe.js chargé).
          </DialogDescription>
        </DialogHeader>
        <form action={formAction} className="flex flex-col gap-3">
          <p className="font-mono text-xs text-muted-foreground">
            Origine : {(() => {
              try {
                return new URL(baseUrl).origin;
              } catch {
                return baseUrl;
              }
            })()}
          </p>

          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="pricing"
              defaultChecked
              className="size-3.5 rounded border-input accent-foreground"
            />
            Tarifs (/pricing, /tarifs ou /prices)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="login"
              defaultChecked
              className="size-3.5 rounded border-input accent-foreground"
            />
            Connexion (/login, /signin ou /auth/login)
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              name="checkout"
              className="size-3.5 rounded border-input accent-foreground"
            />
            J&apos;ai une page checkout (/checkout)
          </label>

          <div className="flex flex-col gap-1">
            <label htmlFor="price-token" className="text-xs text-muted-foreground">
              Symbole / prix à trouver sur la page tarifs
            </label>
            <Input id="price-token" name="price_token" defaultValue="€" />
          </div>

          <DialogFooter>
            <SubmitButton pendingText="Ajout..." disabled={pending}>
              Ajouter
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
