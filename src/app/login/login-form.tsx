"use client";

import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  signInWithGithub,
  signInWithGoogle,
  signInWithMagicLink,
  signInWithPassword,
  signUpWithPassword,
  type MagicLinkState,
} from "./actions";
import { GENERIC_AUTH_MESSAGE } from "./messages";

const initialState: MagicLinkState = { error: null, sent: false };

export function LoginForm({
  plan,
  mode,
  error,
  confirm,
}: {
  plan: string | null;
  mode: string | null;
  error: string | null;
  confirm: boolean;
}) {
  const boundMagicLink = signInWithMagicLink.bind(null, plan);
  const [state, formAction, pending] = useActionState(
    boundMagicLink,
    initialState,
  );
  const [passwordMode, setPasswordMode] = useState<"signin" | "signup">(
    mode === "signup" ? "signup" : "signin",
  );
  // Shared across magic link + OAuth (both can create an account on first
  // use, same as password signup) — a single visible checkbox gates all
  // three, threaded into each <form> as a hidden field since a plain
  // checkbox can only belong to one form at a time.
  const [consentAccepted, setConsentAccepted] = useState(false);

  return (
    <div className="flex w-full max-w-sm flex-col gap-5">
      <label className="flex items-start gap-2 text-xs text-muted-foreground">
        <input
          type="checkbox"
          required
          checked={consentAccepted}
          onChange={(e) => setConsentAccepted(e.target.checked)}
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
          </a>
          , les{" "}
          <a
            href="/cgv"
            target="_blank"
            rel="noreferrer"
            className="text-foreground underline underline-offset-2"
          >
            CGV
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

      <Tabs defaultValue={mode === "signup" || mode === "password" ? "password" : "magic"}>
        <TabsList variant="line" className="w-full">
          <TabsTrigger value="magic" className="flex-1">
            Lien magique
          </TabsTrigger>
          <TabsTrigger value="password" className="flex-1">
            Mot de passe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="magic" className="pt-4">
          {state.sent ? (
            <p className="text-sm text-muted-foreground">
              {GENERIC_AUTH_MESSAGE}
            </p>
          ) : (
            <form action={formAction} className="flex flex-col gap-3">
              <input type="hidden" name="terms_accepted" value={consentAccepted ? "on" : ""} />
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
              <Button type="submit" disabled={pending || !consentAccepted}>
                {pending ? "Envoi..." : "Recevoir un lien magique"}
              </Button>
              {state.error && (
                <p className="text-sm text-destructive">{state.error}</p>
              )}
            </form>
          )}
        </TabsContent>

        <TabsContent value="password" className="pt-4">
          {confirm ? (
            <p className="text-sm text-muted-foreground">
              {GENERIC_AUTH_MESSAGE}
            </p>
          ) : (
            <form
              action={
                passwordMode === "signin"
                  ? signInWithPassword.bind(null, plan)
                  : signUpWithPassword.bind(null, plan)
              }
              className="flex flex-col gap-3"
            >
              <label htmlFor="password-email" className="sr-only">
                Adresse email
              </label>
              <Input
                id="password-email"
                type="email"
                name="email"
                placeholder="vous@exemple.com"
                required
              />
              <label htmlFor="password" className="sr-only">
                Mot de passe
              </label>
              <Input
                id="password"
                type="password"
                name="password"
                placeholder={
                  passwordMode === "signup"
                    ? "8 caractères minimum"
                    : "Mot de passe"
                }
                minLength={passwordMode === "signup" ? 8 : undefined}
                autoComplete={
                  passwordMode === "signin" ? "current-password" : "new-password"
                }
                required
              />
              {passwordMode === "signup" && (
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
                    </a>
                    , les{" "}
                    <a
                      href="/cgv"
                      target="_blank"
                      rel="noreferrer"
                      className="text-foreground underline underline-offset-2"
                    >
                      CGV
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
              )}
              <Button type="submit">
                {passwordMode === "signin" ? "Se connecter" : "Créer mon compte"}
              </Button>
              {error && <p className="text-sm text-destructive">{error}</p>}
              <button
                type="button"
                onClick={() =>
                  setPasswordMode(passwordMode === "signin" ? "signup" : "signin")
                }
                className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
              >
                {passwordMode === "signin"
                  ? "Pas encore de compte ? En créer un"
                  : "Déjà un compte ? Se connecter"}
              </button>
            </form>
          )}
        </TabsContent>
      </Tabs>

      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <span className="h-px flex-1 bg-border" />
        ou
        <span className="h-px flex-1 bg-border" />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <form action={signInWithGoogle.bind(null, plan)}>
          <input type="hidden" name="terms_accepted" value={consentAccepted ? "on" : ""} />
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={!consentAccepted}
          >
            Google
          </Button>
        </form>
        <form action={signInWithGithub.bind(null, plan)}>
          <input type="hidden" name="terms_accepted" value={consentAccepted ? "on" : ""} />
          <Button
            type="submit"
            variant="outline"
            className="w-full"
            disabled={!consentAccepted}
          >
            GitHub
          </Button>
        </form>
      </div>
    </div>
  );
}
