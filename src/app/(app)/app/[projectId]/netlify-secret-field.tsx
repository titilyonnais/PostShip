"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { CopyField } from "@/components/copy-field";
import { generateNetlifyHookSecret, type RegenerateSecretResult } from "./actions";

const initialState: RegenerateSecretResult = {};

// Netlify's "JWS secret token" is a free-text field the person setting it
// up invents, unlike Vercel's and Cloudflare's, which the provider
// generates for you. So the flow runs the other way here: PostShip mints
// the secret, shows it once, and the user pastes it into Netlify.
export function NetlifySecretField({
  projectId,
  configured,
}: {
  projectId: string;
  configured: boolean;
}) {
  const router = useRouter();
  const [state, generate, pending] = useActionState(
    generateNetlifyHookSecret.bind(null, projectId),
    initialState,
  );
  const [secret, setSecret] = useState<string | null>(null);
  const handled = useRef<RegenerateSecretResult | null>(null);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state.secret) {
      setSecret(state.secret);
      toast.success(state.success ?? "Secret généré.");
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <div className="flex flex-col gap-2">
      {secret ? (
        <>
          <CopyField value={secret} label="Le secret" />
          <p className="text-xs text-muted-foreground">
            Collez-le dans Netlify, champ &laquo; JWS secret token &raquo;. Il
            ne sera plus réaffiché.
          </p>
        </>
      ) : (
        <form action={generate}>
          <Button type="submit" variant="outline" size="sm" disabled={pending}>
            {pending
              ? "Génération..."
              : configured
                ? "Générer un nouveau secret"
                : "Générer un secret"}
          </Button>
        </form>
      )}
    </div>
  );
}
