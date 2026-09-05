"use client";

import { useState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

// Typing ANNULER into a bare input told the operator nothing about what
// was about to happen: not what the customer would be charged or
// refunded, not whether they would be emailed, not what the email would
// say. The word was friction without information.
//
// This replaces it with a two-step panel: the button opens a summary of
// the consequences, and only then offers the confirm. The friction is now
// the reading, which is the part that actually prevents mistakes.

function Confirm({ label, danger }: { label: string; danger: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`border px-3 py-1.5 font-mono text-xs disabled:opacity-50 ${
        danger
          ? "border-[#f85149] bg-[#f85149]/10 text-[#f85149] hover:bg-[#f85149]/20"
          : "border-neutral-600 text-neutral-100 hover:border-neutral-400"
      }`}
    >
      {pending ? "En cours..." : label}
    </button>
  );
}

export function ConfirmAction({
  trigger,
  title,
  consequences,
  confirmLabel,
  danger = false,
  action,
  feedback,
  children,
}: {
  trigger: string;
  title: string;
  /** Plain statements of what will happen. Shown as a list, one per line. */
  consequences: string[];
  confirmLabel: string;
  danger?: boolean;
  action: (payload: FormData) => void;
  feedback?: ReactNode;
  /** Optional extra fields inside the form, e.g. a note to the customer. */
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  if (!open) {
    return (
      <div className="flex flex-col gap-1">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className={`self-start border px-3 py-1.5 font-mono text-xs ${
            danger
              ? "border-[#f85149]/40 text-[#f85149] hover:border-[#f85149]"
              : "border-neutral-700 text-neutral-300 hover:border-neutral-500"
          }`}
        >
          {trigger}
        </button>
        {feedback}
      </div>
    );
  }

  return (
    <form
      action={action}
      className={`flex flex-col gap-3 border p-3 ${
        danger ? "border-[#f85149]/40 bg-[#f85149]/5" : "border-neutral-700 bg-neutral-900/40"
      }`}
    >
      <p className="font-mono text-xs text-neutral-100">{title}</p>

      <ul className="flex flex-col gap-1">
        {consequences.map((line) => (
          <li key={line} className="flex gap-2 font-mono text-[0.7rem] text-neutral-400">
            <span aria-hidden="true" className="text-neutral-600">
              →
            </span>
            {line}
          </li>
        ))}
      </ul>

      {children}

      <div className="flex flex-wrap items-center gap-2">
        <Confirm label={confirmLabel} danger={danger} />
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="border border-neutral-800 px-3 py-1.5 font-mono text-xs text-neutral-500 hover:text-neutral-200"
        >
          Revenir
        </button>
      </div>

      {feedback}
    </form>
  );
}

export const NOTE_FIELD =
  "w-full border border-neutral-800 bg-[#0d0f12] px-2 py-1.5 font-mono text-xs text-neutral-100 placeholder:text-neutral-700 focus:border-neutral-600 focus:outline-none";
