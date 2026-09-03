"use client";

import { useRouter, usePathname } from "next/navigation";
import { DOC_CATEGORIES, DOCS } from "@/lib/docs";

// S6 (site backlog): mobile docs nav — a native <select> instead of the
// sidebar, per spec ("un <select> ou liste <details>, pas la sidebar").
export function DocsMobileNav() {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className="md:hidden">
      <label htmlFor="docs-nav" className="mb-1.5 block text-xs text-muted-foreground">
        Aller à…
      </label>
      <select
        id="docs-nav"
        value={pathname}
        onChange={(event) => router.push(event.target.value)}
        className="w-full rounded-2xl border border-border bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <option value="/docs">Index</option>
        {DOC_CATEGORIES.map((category) => (
          <optgroup key={category.label} label={category.label}>
            {category.slugs.map((slug) => (
              <option key={slug} value={`/docs/${slug}`}>
                {DOCS[slug].title}
              </option>
            ))}
          </optgroup>
        ))}
      </select>
    </div>
  );
}
