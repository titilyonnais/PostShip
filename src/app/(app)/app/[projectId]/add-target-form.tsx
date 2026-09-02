"use client";

import { useActionState, useState } from "react";
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
  const [kind, setKind] = useState("http");
  const [showAdvanced, setShowAdvanced] = useState(false);

  return (
    <form action={formAction} className="flex flex-col gap-2">
      <div className="flex flex-col gap-2 sm:flex-row">
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
        <Select
          name="kind"
          defaultValue="http"
          onValueChange={(value) => setKind(value ?? "http")}
        >
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
      </div>

      {kind === "http" && (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="self-start text-xs text-muted-foreground underline underline-offset-2"
          >
            {showAdvanced ? "Masquer les options avancées" : "Options avancées"}
          </button>
          {showAdvanced && (
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="flex flex-col gap-1">
                <label htmlFor="expect-status" className="text-xs text-muted-foreground">
                  Statut attendu
                </label>
                <Input
                  id="expect-status"
                  name="expect_status"
                  type="number"
                  min={100}
                  max={599}
                  defaultValue={200}
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="expect-contains" className="text-xs text-muted-foreground">
                  Doit contenir
                </label>
                <Input
                  id="expect-contains"
                  name="expect_contains"
                  placeholder="ex: Ajouter au panier"
                />
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="expect-not-contains"
                  className="text-xs text-muted-foreground"
                >
                  Ne doit pas contenir
                </label>
                <Input
                  id="expect-not-contains"
                  name="expect_not_contains"
                  placeholder="ex: Erreur 500"
                />
              </div>
            </div>
          )}
        </div>
      )}

      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </form>
  );
}
