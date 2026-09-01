"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Shuffle } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { avatarUrl } from "@/lib/avatar";
import type { ActionResult } from "@/lib/use-toast-action";
import { regenerateAvatar, updateIdentity } from "./actions";

const initialState: ActionResult = {};

export function IdentitySection({
  username,
  avatarSeed,
}: {
  username: string;
  avatarSeed: string;
}) {
  const router = useRouter();
  const [state, dispatch] = useActionState(regenerateAvatar, initialState);
  const handled = useRef<ActionResult | null>(null);

  useEffect(() => {
    if (state === handled.current || (!state.success && !state.error)) return;
    handled.current = state;
    if (state.success) {
      toast.success(state.success);
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return (
    <div className="flex items-end gap-4">
      <div className="flex flex-col items-center gap-1.5">
        {/* eslint-disable-next-line @next/next/no-img-element -- external DiceBear SVG */}
        <img
          src={avatarUrl(avatarSeed, 80)}
          alt="Avatar"
          className="size-16 rounded-full bg-secondary"
          width={64}
          height={64}
        />
        <button
          type="button"
          onClick={() => startTransition(() => dispatch())}
          className="flex items-center gap-1 text-[0.7rem] text-muted-foreground hover:text-foreground"
        >
          <Shuffle className="size-3" aria-hidden="true" />
          Nouvel avatar
        </button>
      </div>
      <ActionForm action={updateIdentity} className="flex flex-1 items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <label htmlFor="username" className="text-xs text-muted-foreground">
            Pseudo
          </label>
          <Input
            key={username}
            id="username"
            name="username"
            defaultValue={username}
            placeholder="ex : jdupont"
          />
        </div>
        <SubmitButton variant="outline" pendingText="...">
          Enregistrer
        </SubmitButton>
      </ActionForm>
    </div>
  );
}
