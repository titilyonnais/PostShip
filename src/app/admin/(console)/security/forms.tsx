"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { changePassword, type SecurityState } from "./actions";

const initial: SecurityState = {};

const FIELD =
  "w-full border border-neutral-800 bg-[#0d0f12] px-2 py-1.5 font-mono text-xs text-neutral-100 placeholder:text-neutral-700 focus:border-[#3fb950] focus:outline-none";

function Submit({ children }: { children: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-neutral-700 px-3 py-1.5 font-mono text-xs text-neutral-200 hover:border-neutral-500 disabled:opacity-50"
    >
      {pending ? "..." : children}
    </button>
  );
}

export function SecurityForms() {
  const [state, formAction] = useActionState(changePassword, initial);

  return (
    <section className="border border-neutral-900 bg-[#0b0d10]">
      <header className="border-b border-neutral-900 px-4 py-2">
        <h2 className="font-mono text-[0.7rem] tracking-[0.15em] text-neutral-500 uppercase">
          Mot de passe
        </h2>
      </header>
      <form action={formAction} className="flex max-w-md flex-col gap-2 p-4">
        {/* Asked again before it can be replaced: an open session on an
            unlocked screen shouldn't be enough to take the account over. */}
        <input
          name="current_password"
          type="password"
          placeholder="Mot de passe actuel"
          autoComplete="current-password"
          required
          className={FIELD}
        />
        <input
          name="new_password"
          type="password"
          placeholder="Nouveau (16 caractères minimum)"
          autoComplete="new-password"
          minLength={16}
          required
          className={FIELD}
        />
        <input
          name="confirm_password"
          type="password"
          placeholder="Confirmer"
          autoComplete="new-password"
          minLength={16}
          required
          className={FIELD}
        />
        {state.error && (
          <p className="font-mono text-xs text-[#f85149]">{state.error}</p>
        )}
        <p className="font-mono text-[0.65rem] text-neutral-700">
          C&apos;est le seul facteur d&apos;authentification de la console.
          Toutes les sessions sont fermées, y compris celle-ci.
        </p>
        <div>
          <Submit>Changer le mot de passe</Submit>
        </div>
      </form>
    </section>
  );
}
