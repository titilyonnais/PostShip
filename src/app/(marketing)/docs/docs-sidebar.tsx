"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { DOC_CATEGORIES, DOCS } from "@/lib/docs";
import { cn } from "@/lib/utils";

// S6 (site backlog): the desktop docs nav — sticky, always visible,
// current page styled non-interactively. Mobile gets docs-mobile-nav.tsx
// instead (a <select>), not this list.
export function DocsSidebar() {
  const pathname = usePathname();

  return (
    <nav
      aria-label="Sommaire de la documentation"
      className="sticky top-24 hidden h-fit w-56 shrink-0 flex-col gap-5 md:flex"
    >
      {DOC_CATEGORIES.map((category) => (
        <div key={category.label} className="flex flex-col gap-1">
          <p className="px-2.5 text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {category.label}
          </p>
          {category.slugs.map((slug) => {
            const href = `/docs/${slug}`;
            const isActive = pathname === href;
            return (
              <Link
                key={slug}
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={cn(
                  "rounded-full px-2.5 py-1 text-sm transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  isActive
                    ? "bg-secondary font-medium text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {DOCS[slug].title}
              </Link>
            );
          })}
        </div>
      ))}
    </nav>
  );
}
