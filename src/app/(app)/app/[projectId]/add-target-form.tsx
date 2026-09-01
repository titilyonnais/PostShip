"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { addTarget, type TargetFormState } from "./actions";

const initialState: TargetFormState = { error: null };

const KIND_OPTIONS: { value: string; label: string }[] = [
  { value: "http", label: "HTTP (statut, contenu)" },
  { value: "og", label: "OG / Twitter" },
  { value: "sitemap", label: "Sitemap" },
  { value: "ssl", label: "SSL (expiration)" },
  { value: "stripe_health", label: "Stripe health (Team)" },
];

export function AddTargetForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(
    addTarget.bind(null, projectId),
    initialState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-2 sm:flex-row">
      <Input
        name="url"
        type="url"
        pattern="https://.*"
        placeholder="https://example.com/checkout"
        required
        className="flex-1"
      />
      <select
        name="kind"
        defaultValue="http"
        className="h-8 rounded-lg border border-border bg-background px-2 text-sm"
      >
        {KIND_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <Button type="submit" disabled={pending}>
        {pending ? "Ajout..." : "Ajouter une URL"}
      </Button>
      {state.error && (
        <p className="text-sm text-destructive sm:basis-full">
          {state.error}
        </p>
      )}
    </form>
  );
}
