"use client";

import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { updateEmail } from "./actions";

export function EmailSection({ currentEmail }: { currentEmail: string }) {
  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Email
      </h2>
      <p className="text-xs text-muted-foreground">
        Email actuel : <span className="text-foreground">{currentEmail}</span>
      </p>
      <ActionForm action={updateEmail} className="flex max-w-sm gap-2">
        <label htmlFor="new-email" className="sr-only">
          Nouvelle adresse email
        </label>
        <Input
          id="new-email"
          name="email"
          type="email"
          placeholder="nouvel-email@exemple.com"
          autoComplete="email"
          className="flex-1"
          required
        />
        <SubmitButton variant="outline" pendingText="...">
          Changer
        </SubmitButton>
      </ActionForm>
      <p className="text-xs text-muted-foreground">
        Un email de confirmation est envoyé à la nouvelle adresse — le
        changement n&apos;est effectif qu&apos;après avoir cliqué sur le lien.
      </p>
    </div>
  );
}
