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

// Feedback fix: the first version tracked open/close with useState +
// mouseenter/mouseleave timers, which glitched badly on a real mouse —
// inserting the panel into the DOM right under the cursor makes the
// browser recompute what's being hovered, which can fire a spurious
// mouseleave and slam the menu shut mid-hover. Pure CSS instead: the
// panel is always mounted (invisible + opacity-0), toggled by
// group-hover/group-focus-within — no re-render, no DOM mutation under
// the pointer, no timing race. `invisible` (not `hidden`) so its box
// still occupies the group's hoverable area between the trigger and the
// panel itself, and focus-within keeps it reachable by keyboard.
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
  return (
    <div className="group relative">
      <Link
        href={href}
        aria-haspopup="true"
        aria-current={active ? "page" : undefined}
        className={cn(NAV_LINK_CLASS, active && "font-medium text-foreground")}
      >
        {label}
        <ChevronDown
          className="size-3 transition-transform duration-200 group-hover:rotate-180 group-focus-within:rotate-180"
          aria-hidden="true"
        />
      </Link>
      <div className="invisible absolute left-1/2 top-full z-50 w-80 -translate-x-1/2 pt-3 opacity-0 transition-opacity duration-150 group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100">
        <div className="flex flex-col gap-1 rounded-2xl border border-border bg-card p-2 shadow-xl shadow-black/30">
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-start gap-3 rounded-xl p-2.5 text-left transition-colors hover:bg-secondary"
            >
              <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-xl bg-brand-2/10 text-brand-2">
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
    </div>
  );
}
