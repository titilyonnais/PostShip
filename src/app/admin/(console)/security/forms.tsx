"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  changePassword,
  confirmTotpRotation,
  startTotpRotation,
  type SecurityState,
} from "./actions";

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

// Both factors are asked for again before either can be changed: a session
// left open on an unlocked screen shouldn't be enough to take the account
// over permanently.
function Reauth() {
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <input
        name="current_password"
        type="password"
        placeholder="Mot de passe actuel"
        autoComplete="current-password"
        required
        className={FIELD}
      />
      <input
        name="current_code"
        inputMode="numeric"
        maxLength={6}
        placeholder="Code actuel"
        autoComplete="one-time-code"
        required
        className={FIELD}
      />
    </div>
  );
}

function Feedback({ state }: { state: SecurityState }) {
  if (state.error) {
    return <p className="font-mono text-xs text-[#f85149]">{state.error}</p>;
  }
  if (state.success) {
    return <p className="font-mono text-xs text-[#3fb950]">{state.success}</p>;
  }
  return null;
}

export function SecurityForms() {
  const [passwordState, passwordAction] = useActionState(changePassword, initial);
  const [startState, startAction] = useActionState(startTotpRotation, initial);
  const [confirmState, confirmAction] = useActionState(confirmTotpRotation, initial);

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <section className="border border-neutral-900 bg-[#0b0d10]">
        <header className="border-b border-neutral-900 px-4 py-2">
          <h2 className="font-mono text-[0.7rem] tracking-[0.15em] text-neutral-500 uppercase">
            Mot de passe
          </h2>
        </header>
        <form action={passwordAction} className="flex flex-col gap-2 p-4">
          <Reauth />
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
          <Feedback state={passwordState} />
          <p className="font-mono text-[0.65rem] text-neutral-700">
            Toutes les sessions sont fermées, y compris celle-ci.
          </p>
          <div>
            <Submit>Changer le mot de passe</Submit>
          </div>
        </form>
      </section>

      <section className="border border-neutral-900 bg-[#0b0d10]">
        <header className="border-b border-neutral-900 px-4 py-2">
          <h2 className="font-mono text-[0.7rem] tracking-[0.15em] text-neutral-500 uppercase">
            Application d&apos;authentification
          </h2>
        </header>
        <div className="flex flex-col gap-3 p-4">
          <form action={startAction} className="flex flex-col gap-2">
            <Reauth />
            <Feedback state={startState} />
            <div>
              <Submit>Générer un nouveau secret</Submit>
            </div>
          </form>

          {startState.uri && startState.secret && (
            <div className="flex flex-col gap-2 border-t border-neutral-900 pt-3">
              <p className="font-mono text-[0.65rem] break-all text-neutral-500">
                Clé : <span className="text-neutral-200">{startState.secret}</span>
              </p>
              <p className="font-mono text-[0.65rem] break-all text-neutral-600">
                {startState.uri}
              </p>
              <form action={confirmAction} className="flex gap-2">
                <input
                  name="new_code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="Code de la nouvelle app"
                  autoComplete="one-time-code"
                  required
                  className={FIELD}
                />
                <Submit>Confirmer</Submit>
              </form>
              <Feedback state={confirmState} />
            </div>
          )}

          <p className="font-mono text-[0.65rem] text-neutral-700">
            L&apos;ancien secret reste valide tant que le nouveau n&apos;a pas
            été confirmé : une rotation interrompue ne peut pas vous enfermer
            dehors.
          </p>
        </div>
      </section>
    </div>
  );
}
