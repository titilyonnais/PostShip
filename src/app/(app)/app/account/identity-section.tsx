"use client";

import { startTransition, useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Shuffle, Upload } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { resolveAvatarUrl } from "@/lib/avatar";
import { useToastAction, type ActionResult } from "@/lib/use-toast-action";
import { regenerateAvatar, updateIdentity, uploadAvatarPhoto } from "./actions";

const initialState: ActionResult = {};

function AvatarUploadForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const { formAction, pending } = useToastAction(uploadAvatarPhoto);

  return (
    <form ref={formRef} action={formAction}>
      <label className="flex cursor-pointer items-center gap-1 text-[0.7rem] text-muted-foreground hover:text-foreground">
        <Upload className="size-3" aria-hidden="true" />
        {pending ? "Envoi..." : "Importer une photo"}
        <input
          type="file"
          name="photo"
          accept="image/png,image/jpeg,image/webp"
          className="sr-only"
          disabled={pending}
          onChange={() => formRef.current?.requestSubmit()}
        />
      </label>
    </form>
  );
}

export function IdentitySection({
  username,
  avatarSeed,
  avatarUrl,
}: {
  username: string;
  avatarSeed: string;
  avatarUrl: string | null;
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
        {/* eslint-disable-next-line @next/next/no-img-element -- external avatar (DiceBear or an uploaded photo) */}
        <img
          src={resolveAvatarUrl({ avatar_url: avatarUrl, avatar_seed: avatarSeed }, avatarSeed, 80)}
          alt="Avatar"
          className="size-16 rounded-full bg-secondary"
          width={64}
          height={64}
        />
        <AvatarUploadForm />
        <button
          type="button"
          onClick={() => startTransition(() => dispatch())}
          className="flex items-center gap-1 text-[0.7rem] text-muted-foreground hover:text-foreground"
        >
          <Shuffle className="size-3" aria-hidden="true" />
          Avatar généré
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
