"use client";

import { useActionState } from "react";
import { SubmitButton } from "@/components/submit-button";
import { addTarget, type TargetFormState } from "../actions";

const initialState: TargetFormState = { error: null };

export function AddSslButton({ projectId, baseUrl }: { projectId: string; baseUrl: string }) {
  const [state, formAction] = useActionState(addTarget.bind(null, projectId), initialState);

  return (
    <form action={formAction} className="flex flex-col items-end gap-1">
      <input type="hidden" name="kind" value="ssl" />
      <input type="hidden" name="url" value={baseUrl} />
      <SubmitButton variant="outline" pendingText="Ajout...">
        Ajouter un check SSL
      </SubmitButton>
      {state.error && (
        <p role="alert" className="text-xs text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
