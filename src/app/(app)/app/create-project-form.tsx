"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createProject, type ProjectFormState } from "./actions";

const initialState: ProjectFormState = { error: null };

export function CreateProjectForm() {
  const [state, formAction, pending] = useActionState(
    createProject,
    initialState,
  );

  return (
    <form
      action={formAction}
      className="flex flex-col gap-3 rounded-md border border-border p-4 sm:flex-row sm:items-end"
    >
      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="name" className="text-xs text-muted-foreground">
          Nom
        </label>
        <Input id="name" name="name" placeholder="Mon SaaS" required />
      </div>
      <div className="flex flex-1 flex-col gap-1">
        <label htmlFor="base_url" className="text-xs text-muted-foreground">
          URL de prod
        </label>
        <Input
          id="base_url"
          name="base_url"
          type="url"
          pattern="https://.*"
          placeholder="https://example.com"
          required
        />
      </div>
      <Button type="submit" disabled={pending}>
        {pending ? "Création..." : "Créer le projet"}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive sm:basis-full">
          {state.error}
        </p>
      )}
    </form>
  );
}
