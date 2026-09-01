"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type DemoResult = {
  outcome: string;
  http_status: number | null;
  ttfb_ms: number | null;
};

export function DemoForm() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<DemoResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch("/api/demo/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Erreur.");
      } else {
        setResult(data);
      }
    } catch {
      setError("Erreur réseau.");
    } finally {
      setPending(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-3 sm:flex-row sm:items-center"
    >
      <label htmlFor="demo-url" className="sr-only">
        URL à vérifier
      </label>
      <Input
        id="demo-url"
        type="url"
        pattern="https://.*"
        placeholder="https://votre-site.com"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
        required
        className="flex-1"
        aria-describedby={error ? "demo-error" : undefined}
      />
      <Button type="submit" disabled={pending}>
        {pending ? "Vérification..." : "Tester une URL"}
      </Button>
      {error && (
        <p
          id="demo-error"
          role="alert"
          className="text-sm text-destructive sm:basis-full"
        >
          {error}
        </p>
      )}
      {result && (
        <p
          role="status"
          className="text-sm text-muted-foreground sm:basis-full"
        >
          {result.outcome === "pass" ? "✅" : "🔴"} statut{" "}
          {result.http_status ?? "—"} ·{" "}
          {result.ttfb_ms != null ? `${result.ttfb_ms} ms` : "—"}
        </p>
      )}
    </form>
  );
}
