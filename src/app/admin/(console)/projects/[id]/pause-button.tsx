"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { toggleProjectPause, type ProjectActionState } from "./actions";

const initial: ProjectActionState = {};

function Submit({ paused }: { paused: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="self-start border border-neutral-700 px-3 py-1 font-mono text-xs text-neutral-200 hover:border-neutral-500 disabled:opacity-50"
    >
      {pending ? "..." : paused ? "Relancer le projet" : "Mettre en pause"}
    </button>
  );
}

export function PauseButton({ projectId, paused }: { projectId: string; paused: boolean }) {
  const [state, action] = useActionState(
    toggleProjectPause.bind(null, projectId, paused),
    initial,
  );

  return (
    <form action={action} className="flex flex-col gap-1">
      <Submit paused={paused} />
      {state.error && <span className="font-mono text-xs text-[#f85149]">{state.error}</span>}
      {state.success && (
        <span className="font-mono text-xs text-[#3fb950]">{state.success}</span>
      )}
    </form>
  );
}
