"use client";

import { useMemo } from "react";
import { usePathname } from "next/navigation";
import { RESERVED_APP_SEGMENTS } from "@/components/sidebar/nav-config";

export type Project = {
  id: string;
  name: string;
  base_url: string;
  last_status: string | null;
  alerts_silenced_until?: string | null;
};

// Shared by AppSidebar (nav-item active state) and ProjectBar (switcher +
// title + actions) — both need to know "which project, if any, does the
// current URL belong to" from the same pathname-parsing rule.
export function useActiveProject(projects: Project[]) {
  const pathname = usePathname();
  return useMemo(() => {
    const segments = pathname.split("/").filter(Boolean);
    // segments[0] === "app"
    const candidate = segments[1];
    if (!candidate || RESERVED_APP_SEGMENTS.has(candidate)) {
      return { project: null, subSegment: undefined as string | undefined, pathname };
    }
    const project = projects.find((p) => p.id === candidate) ?? null;
    return { project, subSegment: segments[2], pathname };
  }, [pathname, projects]);
}
