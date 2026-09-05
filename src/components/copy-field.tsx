"use client";

import { Check, Copy } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

// A mono value the user has to move into another product's settings — a
// deploy-hook URL, a generated secret. It used to be plain text you had
// to select by hand across a line wrap, which is exactly where a
// half-copied URL comes from.
export function CopyField({
  value,
  label,
  className = "",
}: {
  value: string;
  /** What the toast calls it, e.g. "URL du webhook". */
  label: string;
  className?: string;
}) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function copy() {
    navigator.clipboard.writeText(value).then(
      () => {
        setCopied(true);
        toast.success(`${label} copiée.`);
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setCopied(false), 2000);
      },
      () => toast.error(`Impossible de copier ${label.toLowerCase()}.`),
    );
  }

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Copier ${label.toLowerCase()}`}
      className={`group flex w-full items-center gap-2 rounded-xl bg-secondary px-2 py-1.5 text-left transition-colors hover:bg-secondary/70 focus-visible:ring-1 focus-visible:ring-foreground/25 focus-visible:outline-none ${className}`}
    >
      <span className="min-w-0 flex-1 break-all font-mono text-xs text-muted-foreground group-hover:text-foreground">
        {value}
      </span>
      {copied ? (
        <Check className="size-3.5 shrink-0 text-[#3fb950]" aria-hidden="true" />
      ) : (
        <Copy
          className="size-3.5 shrink-0 text-muted-foreground group-hover:text-foreground"
          aria-hidden="true"
        />
      )}
    </button>
  );
}
