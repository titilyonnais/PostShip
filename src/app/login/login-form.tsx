"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  signInWithGithub,
  signInWithGoogle,
  signInWithMagicLink,
  type MagicLinkState,
} from "./actions";

const initialState: MagicLinkState = { error: null, sent: false };

export function LoginForm({ plan }: { plan: string | null }) {
  const boundMagicLink = signInWithMagicLink.bind(null, plan);
  const [state, formAction, pending] = useActionState(
    boundMagicLink,
    initialState,
  );

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      {state.sent ? (
        <p className="text-sm text-muted-foreground">
          Lien envoyé. Vérifiez votre boîte mail.
        </p>
      ) : (
        <form action={formAction} className="flex flex-col gap-3">
          <label htmlFor="email" className="sr-only">
            Adresse email
          </label>
          <Input
            id="email"
            type="email"
            name="email"
            placeholder="vous@exemple.com"
            required
          />
          <Button type="submit" disabled={pending}>
            {pending ? "Envoi..." : "Recevoir un lien magique"}
          </Button>
          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}
        </form>
      )}

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={signInWithGoogle.bind(null, plan)}>
        <Button type="submit" variant="outline" className="w-full">
          Continuer avec Google
        </Button>
      </form>

      <form action={signInWithGithub.bind(null, plan)}>
        <Button type="submit" variant="outline" className="w-full">
          Continuer avec GitHub
        </Button>
      </form>
    </div>
  );
}
