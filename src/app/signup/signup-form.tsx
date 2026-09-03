"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  sendEmailCode,
  signInWithGithub,
  signInWithGoogle,
  signUpWithPassword,
  verifyEmailCode,
  type EmailCodeState,
} from "@/app/login/actions";
import { GENERIC_AUTH_MESSAGE } from "@/app/login/messages";

const initialCodeState: EmailCodeState = { error: null, sent: false, email: null };

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="currentColor"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.99.66-2.25 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.85A11 11 0 0 0 12 23z"
      />
      <path
        fill="currentColor"
        d="M5.84 14.09A6.6 6.6 0 0 1 5.5 12c0-.73.12-1.43.34-2.09V7.06H2.18A11 11 0 0 0 1 12c0 1.78.43 3.46 1.18 4.94z"
      />
      <path
        fill="currentColor"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1A11 11 0 0 0 2.18 7.06l3.66 2.85c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function GitHubIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="currentColor"
        d="M12 1a11 11 0 0 0-3.48 21.44c.55.1.75-.24.75-.53v-1.85c-3.06.67-3.71-1.47-3.71-1.47-.5-1.27-1.22-1.6-1.22-1.6-1-.68.08-.67.08-.67 1.1.08 1.68 1.13 1.68 1.13.98 1.68 2.57 1.19 3.2.91.1-.71.38-1.19.7-1.47-2.44-.28-5-1.22-5-5.44 0-1.2.43-2.19 1.13-2.96-.11-.28-.49-1.4.11-2.92 0 0 .92-.3 3.02 1.13a10.4 10.4 0 0 1 5.5 0c2.1-1.43 3.02-1.13 3.02-1.13.6 1.52.22 2.64.11 2.92.7.77 1.13 1.76 1.13 2.96 0 4.23-2.57 5.16-5.02 5.43.4.34.75 1.02.75 2.06v3.05c0 .29.2.64.76.53A11 11 0 0 0 12 1z"
      />
    </svg>
  );
}

function EmailCodeTab({ plan }: { plan: string }) {
  const [state, sendAction, sendPending] = useActionState(
    sendEmailCode.bind(null, plan),
    initialCodeState,
  );
  const [verifyState, verifyAction, verifyPending] = useActionState(
    verifyEmailCode.bind(null, plan, state.email ?? ""),
    initialCodeState,
  );

  if (state.sent && state.email) {
    return (
      <div className="flex flex-col gap-3">
        <form action={verifyAction} className="flex flex-col gap-3">
          <p className="text-xs text-muted-foreground">
            Code envoyé à <span className="text-foreground">{state.email}</span>.
          </p>
          <label htmlFor="signup-code" className="sr-only">
            Code de vérification
          </label>
          <Input
            id="signup-code"
            name="code"
            inputMode="numeric"
            maxLength={6}
            placeholder="123456"
            autoComplete="one-time-code"
            autoFocus
            required
            className="text-center font-mono text-lg tracking-[0.3em]"
          />
          <SubmitButton disabled={verifyPending} pendingText="Vérification...">
            Créer mon compte
          </SubmitButton>
          {verifyState.error && (
            <p role="alert" className="text-sm text-destructive">
              {verifyState.error}
            </p>
          )}
        </form>
        <form action={sendAction} className="self-start">
          <input type="hidden" name="email" value={state.email} />
          <button
            type="submit"
            className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
          >
            Renvoyer le code
          </button>
        </form>
      </div>
    );
  }

  return (
    <form action={sendAction} className="flex flex-col gap-3">
      <label htmlFor="signup-email" className="text-xs text-muted-foreground">
        Email
      </label>
      <Input
        id="signup-email"
        type="email"
        name="email"
        autoComplete="email"
        placeholder="vous@exemple.com"
        required
      />
      <Button type="submit" disabled={sendPending}>
        {sendPending ? "Envoi..." : "Recevoir un code par email"}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}

export function SignupForm({
  plan,
  planLabel,
  error,
  confirm,
}: {
  plan: string;
  planLabel: string;
  error: string | null;
  confirm: boolean;
}) {
  return (
    <div className="flex w-full max-w-sm flex-col gap-5">
      <div className="flex flex-col items-center gap-1 text-center">
        <h1 className="text-lg font-semibold">Créer un compte</h1>
        <p className="text-xs text-muted-foreground">
          Plan sélectionné : {planLabel}
          {" — "}
          <Link href="/pricing" className="underline underline-offset-2 hover:text-foreground">
            changer
          </Link>
        </p>
      </div>

      <Tabs defaultValue={error ? "password" : "code"}>
        <TabsList variant="line" className="w-full">
          <TabsTrigger value="code" className="flex-1">
            Code par email
          </TabsTrigger>
          <TabsTrigger value="password" className="flex-1">
            Mot de passe
          </TabsTrigger>
        </TabsList>

        <TabsContent value="code" className="pt-4">
          <EmailCodeTab plan={plan} />
        </TabsContent>

        <TabsContent value="password" className="pt-4">
          {confirm ? (
            <p className="text-sm text-muted-foreground">{GENERIC_AUTH_MESSAGE}</p>
          ) : (
            <form action={signUpWithPassword.bind(null, plan)} className="flex flex-col gap-3">
              <label htmlFor="signup-password-email" className="text-xs text-muted-foreground">
                Email
              </label>
              <Input
                id="signup-password-email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="vous@exemple.com"
                required
              />
              <label htmlFor="signup-password" className="sr-only">
                Mot de passe
              </label>
              <Input
                id="signup-password"
                type="password"
                name="password"
                placeholder="8 caractères minimum"
                minLength={8}
                autoComplete="new-password"
                required
              />
              <label className="flex items-start gap-2 text-xs text-muted-foreground">
                <input
                  type="checkbox"
                  name="terms_accepted"
                  required
                  className="mt-0.5 size-3.5 rounded border-input accent-foreground"
                />
                <span>
                  J&apos;accepte les{" "}
                  <a href="/terms" target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-2">
                    CGU
                  </a>
                  , les{" "}
                  <a href="/cgv" target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-2">
                    CGV
                  </a>{" "}
                  et la{" "}
                  <a href="/privacy" target="_blank" rel="noreferrer" className="text-foreground underline underline-offset-2">
                    politique de confidentialité
                  </a>
                  .
                </span>
              </label>
              <SubmitButton pendingText="Création...">Créer mon compte</SubmitButton>
              {error && (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              )}
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
        <form action={signInWithGoogle.bind(null, plan, "signup")}>
          <Button type="submit" variant="outline" className="w-full gap-1.5">
            <GoogleIcon />
            Google
          </Button>
        </form>
        <form action={signInWithGithub.bind(null, plan, "signup")}>
          <Button type="submit" variant="outline" className="w-full gap-1.5">
            <GitHubIcon />
            GitHub
          </Button>
        </form>
      </div>

      <p className="text-center text-xs text-muted-foreground">
        Déjà un compte ?{" "}
        <Link href="/login" className="text-foreground underline underline-offset-2">
          Se connecter
        </Link>
      </p>

      <p className="text-center text-[0.7rem] text-muted-foreground">
        En continuant, vous acceptez nos{" "}
        <a href="/terms" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
          CGU
        </a>
        , nos{" "}
        <a href="/cgv" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
          CGV
        </a>{" "}
        et notre{" "}
        <a href="/privacy" target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:text-foreground">
          politique de confidentialité
        </a>
        .
      </p>
    </div>
  );
}
