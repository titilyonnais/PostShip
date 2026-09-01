"use client";

import {
  startTransition,
  useActionState,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  Copy,
  MoreHorizontal,
  Power,
  RotateCw,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ActionResult } from "@/lib/use-toast-action";
import { deleteTarget, runTargetNow, toggleTarget } from "./actions";

const initialState: ActionResult = {};

export function TargetActionsMenu({
  projectId,
  targetId,
  url,
  enabled,
}: {
  projectId: string;
  targetId: string;
  url: string;
  enabled: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const [relaunchState, relaunch, relaunchPending] = useActionState(
    runTargetNow.bind(null, projectId, targetId),
    initialState,
  );
  const [toggleState, toggle, togglePending] = useActionState(
    toggleTarget.bind(null, projectId, targetId, enabled),
    initialState,
  );
  const [deleteState, remove, deletePending] = useActionState(
    deleteTarget.bind(null, projectId, targetId),
    initialState,
  );

  const handled = useRef<ActionResult | null>(null);
  useEffect(() => {
    for (const state of [relaunchState, toggleState, deleteState]) {
      if (state === handled.current || (!state.success && !state.error)) continue;
      handled.current = state;
      if (state.success) {
        toast.success(state.success);
        router.refresh();
      } else if (state.error) {
        toast.error(state.error);
      }
    }
  }, [relaunchState, toggleState, deleteState, router]);

  const pending = relaunchPending || togglePending || deletePending;

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            disabled={pending}
            aria-label={`Actions pour ${url}`}
          >
            <MoreHorizontal className="size-4" aria-hidden="true" />
          </Button>
        }
      />
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => startTransition(() => relaunch())}>
          <RotateCw className="size-3.5" aria-hidden="true" />
          Relancer maintenant
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            navigator.clipboard.writeText(url).then(
              () => toast.success("URL copiée."),
              () => toast.error("Impossible de copier l'URL."),
            );
          }}
        >
          <Copy className="size-3.5" aria-hidden="true" />
          Copier l&apos;URL
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => startTransition(() => toggle())}>
          <Power className="size-3.5" aria-hidden="true" />
          {enabled ? "Désactiver" : "Activer"}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          variant="destructive"
          onClick={() => {
            if (
              window.confirm(
                `Supprimer définitivement ${url} et tout son historique de vérification ?`,
              )
            ) {
              startTransition(() => remove());
            }
          }}
        >
          <Trash2 className="size-3.5" aria-hidden="true" />
          Supprimer
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
