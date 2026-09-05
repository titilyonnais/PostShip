"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { rescoreAccounts, type SweepState } from "./actions";

const initial: SweepState = {};

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="border border-neutral-800 px-2 py-1 font-mono text-xs text-neutral-400 hover:border-neutral-600 hover:text-neutral-100 disabled:opacity-50"
    >
      {pending ? "Évaluation…" : "Réévaluer maintenant"}
    </button>
  );
}

export function RescoreButton() {
  const [state, action] = useActionState(rescoreAccounts, initial);

  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <Submit />
      {state.error && <span className="font-mono text-xs text-[#f85149]">{state.error}</span>}
      {state.success && (
        <span className="font-mono text-xs text-[#3fb950]">{state.success}</span>
      )}
    </form>
  );
}
