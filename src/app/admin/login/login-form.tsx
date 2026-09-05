"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { adminSignIn, type LoginState } from "./actions";

const initialState: LoginState = {};

const FIELD =
  "w-full rounded-md border border-neutral-800 bg-[#0d0f12] px-3 py-2 font-mono text-sm text-neutral-100 placeholder:text-neutral-600 focus:border-[#3fb950] focus:outline-none";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-md bg-neutral-100 px-3 py-2 font-mono text-sm font-medium text-neutral-950 transition-opacity hover:opacity-90 disabled:opacity-50"
    >
      {pending ? "Vérification..." : "Ouvrir la session"}
    </button>
  );
}

export function AdminLoginForm() {
  const [state, formAction] = useActionState(adminSignIn, initialState);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <label htmlFor="username" className="font-mono text-[0.7rem] text-neutral-500">
          Identifiant
        </label>
        <input
          id="username"
          name="username"
          autoComplete="username"
          required
          spellCheck={false}
          autoCapitalize="none"
          className={FIELD}
        />
      </div>

      <div className="flex flex-col gap-1">
        <label htmlFor="password" className="font-mono text-[0.7rem] text-neutral-500">
          Mot de passe
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          className={FIELD}
        />
      </div>

      {state.error && (
        <p role="alert" className="font-mono text-xs text-[#f85149]">
          {state.error}
        </p>
      )}

      <Submit />
    </form>
  );
}
