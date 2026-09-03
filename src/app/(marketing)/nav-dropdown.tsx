"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { ChevronDown, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export type NavDropdownItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

const NAV_LINK_CLASS =
  "inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

// Hover-revealed mega menu for the marketing header's Produit/Documentation
// links — a short close delay (not an instant unmount) so moving the
// pointer diagonally from the trigger into the panel doesn't flicker it
// shut, the classic hover-menu gotcha.
export function NavDropdown({
  label,
  href,
  active,
  items,
}: {
  label: string;
  href: string;
  active: boolean;
  items: NavDropdownItem[];
}) {
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function openNow() {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    setOpen(true);
  }
  function closeSoon() {
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  }

  return (
    <div className="relative" onMouseEnter={openNow} onMouseLeave={closeSoon}>
      <Link
        href={href}
        aria-expanded={open}
        aria-current={active ? "page" : undefined}
        onFocus={openNow}
        onKeyDown={(event) => {
          if (event.key === "Escape") setOpen(false);
        }}
        className={cn(NAV_LINK_CLASS, active && "font-medium text-foreground")}
      >
        {label}
        <ChevronDown
          className={cn("size-3 transition-transform duration-200", open && "rotate-180")}
          aria-hidden="true"
        />
      </Link>
      {open && (
        <div
          onMouseEnter={openNow}
          onMouseLeave={closeSoon}
          className="absolute left-1/2 top-full z-50 w-80 -translate-x-1/2 pt-3 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-top-1 motion-safe:duration-150"
        >
          <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-2 shadow-xl shadow-black/30">
            {items.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="flex items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-secondary"
              >
                <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-brand-2/10 text-brand-2">
                  <item.icon className="size-4" aria-hidden="true" />
                </span>
                <span className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium text-foreground">{item.label}</span>
                  <span className="text-xs text-muted-foreground">{item.description}</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
