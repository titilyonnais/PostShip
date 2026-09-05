"use client";

import { usePathname } from "next/navigation";
import { Measure } from "@/components/measure";

// Keyed on the path so a client-side navigation ends the previous page's
// measurement and starts a new one — without this, a single-page session
// would record one visit and a very long engagement.
export function MeasureRoute() {
  const pathname = usePathname();
  if (pathname.startsWith("/admin")) return null;
  return <Measure key={pathname} path={pathname} />;
}
