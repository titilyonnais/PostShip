"use client";

import { useActionState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

export type ActionResult = { success?: string; error?: string };

const initialState: ActionResult = {};

// Drives a "use server" action from a client form without ever navigating —
// the action returns {success|error} instead of calling redirect(), and this
// hook turns that into a toast plus a soft refresh of the current route's
// server data. Avoids the full-page transition (and its dark flash) that a
// redirect-based action triggers for actions the user repeats often.
export function useToastAction(
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>,
) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(action, initialState);
  const handled = useRef(state);

  useEffect(() => {
    if (state === handled.current) return;
    handled.current = state;
    if (state.success) {
      toast.success(state.success);
      router.refresh();
    } else if (state.error) {
      toast.error(state.error);
    }
  }, [state, router]);

  return { formAction, pending };
}
