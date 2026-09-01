"use client";

import { useActionState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
      <label htmlFor="target-url" className="sr-only">
        URL à surveiller
      </label>
      <Input
        id="target-url"
        name="url"
        type="url"
        pattern="https://.*"
        placeholder="https://example.com/checkout"
        required
        className="flex-1"
      />
      <label htmlFor="target-kind" className="sr-only">
        Type de vérification
      </label>
      <Select name="kind" defaultValue="http">
        <SelectTrigger id="target-kind" className="sm:w-56">
          <SelectValue>
            {(value: string) =>
              KIND_OPTIONS.find((o) => o.value === value)?.label ?? value
            }
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {KIND_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button type="submit" disabled={pending}>
        {pending ? "Ajout..." : "Ajouter une URL"}
      </Button>
      {state.error && (
        <p role="alert" className="text-sm text-destructive sm:basis-full">
          {state.error}
        </p>
      )}
    </form>
  );
}
