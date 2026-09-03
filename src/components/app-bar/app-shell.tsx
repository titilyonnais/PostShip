"use client";

import { useState } from "react";
import { AppSidebar } from "@/components/sidebar/app-sidebar";
import type { Project } from "@/lib/use-active-project";
import { ProjectBar } from "./project-bar";

type Profile = {
  displayName: string;
  email: string;
  avatarUrl: string;
};

// B1 (app-bar backlog): the mobile drawer's open state is shared between
// ProjectBar (renders the single "Ouvrir le menu" trigger, merged with the
// switcher — no more separate sidebar header) and AppSidebar (renders the
// drawer itself) — lifted here since (app)/layout.tsx is a server
// component and can't hold it.
export function AppShell({
  projects,
  profile,
  openIncidentCounts,
}: {
  projects: Project[];
  profile: Profile;
  openIncidentCounts: Record<string, number>;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      <ProjectBar projects={projects} onOpenMobile={() => setMobileOpen(true)} />
      <AppSidebar
        projects={projects}
        profile={profile}
        openIncidentCounts={openIncidentCounts}
        mobileOpen={mobileOpen}
        onCloseMobile={() => setMobileOpen(false)}
      />
    </>
  );
}
