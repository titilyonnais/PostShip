"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { verifyMfaChallenge, type MfaChallengeState } from "./actions";

const initialState: MfaChallengeState = { error: null };

export function MfaChallengeForm({ factorId }: { factorId: string }) {
  const [state, formAction] = useActionState(
    verifyMfaChallenge.bind(null, factorId),
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <label htmlFor="code" className="sr-only">
        Code de vérification
      </label>
      <Input
        id="code"
        name="code"
        inputMode="numeric"
        maxLength={6}
        placeholder="123456"
        autoComplete="one-time-code"
        autoFocus
        required
        className="text-center font-mono text-lg tracking-[0.3em]"
      />
      <SubmitButton pendingText="Vérification...">Vérifier</SubmitButton>
      {state.error && (
        <p role="alert" className="text-center text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
