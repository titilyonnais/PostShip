"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { setIpTrusted, type TrustState } from "./actions";

const initial: TrustState = {};

function Submit({ trusted }: { trusted: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start border border-neutral-700 px-3 py-1 font-mono text-xs text-neutral-200 hover:border-neutral-500 disabled:opacity-50"
    >
      {pending ? "..." : trusted ? "Retirer la confiance" : "Marquer de confiance"}
    </button>
  );
}

export function TrustToggle({ ip, trusted }: { ip: string; trusted: boolean }) {
  const [state, action] = useActionState(setIpTrusted.bind(null, ip, !trusted), initial);

  return (
    <form action={action} className="flex flex-col gap-1">
      <Submit trusted={trusted} />
      <p className="font-mono text-[0.65rem] text-neutral-700">
        Une adresse de confiance cesse d&apos;alimenter le signal « comptes
        multiples » du score de fraude.
      </p>
      {state.error && <span className="font-mono text-xs text-[#f85149]">{state.error}</span>}
      {state.success && (
        <span className="font-mono text-xs text-[#3fb950]">{state.success}</span>
      )}
    </form>
  );
}
