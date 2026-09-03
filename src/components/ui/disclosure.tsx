"use client";

import { useId } from "react";
import { ChevronDown } from "lucide-react";

// Feedback fix: "options avancées" toggles used to be a bare underlined
// text button with an instant show/hide — no affordance that it expands,
// no transition. The grid-template-rows trick animates height without
// measuring the content (which a max-height guess can't do reliably).
export function Disclosure({
  open,
  onOpenChange,
  label,
  openLabel,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  openLabel?: string;
  children: React.ReactNode;
}) {
  const id = useId();

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => onOpenChange(!open)}
        aria-expanded={open}
        aria-controls={id}
        className="inline-flex w-fit items-center gap-1.5 rounded-full border border-border bg-secondary/40 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-foreground/20 hover:bg-secondary hover:text-foreground"
      >
        <ChevronDown
          className={`size-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          aria-hidden="true"
        />
        {open ? (openLabel ?? label) : label}
      </button>
      <div
        id={id}
        className="grid transition-[grid-template-rows] duration-300 ease-out"
        style={{ gridTemplateRows: open ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">{children}</div>
      </div>
    </div>
  );
}
