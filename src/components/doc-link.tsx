import Link from "next/link";
import { BookOpen } from "lucide-react";

// Every integration needs a handful of clicks inside its own product
// before PostShip can post anything, and those steps don't fit in the
// one-line hint under a field — so each card points at its own doc page.
// Opened in a new tab: you're mid-configuration, and losing this page
// means losing whatever you already pasted into it.
export function DocLink({
  href,
  label = "Comment le configurer",
}: {
  href: string;
  label?: string;
}) {
  return (
    <Link
      href={href}
      target="_blank"
      rel="noreferrer"
      className="inline-flex shrink-0 items-center gap-1 text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
    >
      <BookOpen className="size-3" aria-hidden="true" />
      {label}
    </Link>
  );
}
