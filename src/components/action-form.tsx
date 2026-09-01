"use client";

import type { ComponentProps } from "react";
import { useToastAction, type ActionResult } from "@/lib/use-toast-action";

export function ActionForm({
  action,
  ...props
}: {
  action: (prevState: ActionResult, formData: FormData) => Promise<ActionResult>;
} & Omit<ComponentProps<"form">, "action">) {
  const { formAction } = useToastAction(action);
  return <form action={formAction} {...props} />;
}
