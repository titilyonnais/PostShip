"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const VALID_TABS = new Set(["overview", "settings"]);

export function ProjectTabs({
  defaultTab,
  overview,
  settings,
}: {
  defaultTab?: string;
  overview: ReactNode;
  settings: ReactNode;
}) {
  const initialTab =
    defaultTab && VALID_TABS.has(defaultTab) ? defaultTab : "overview";

  return (
    <Tabs defaultValue={initialTab} className="gap-6">
      <TabsList variant="line">
        <TabsTrigger value="overview">Aperçu</TabsTrigger>
        <TabsTrigger value="settings">Paramètres</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">{overview}</TabsContent>
      <TabsContent value="settings">{settings}</TabsContent>
    </Tabs>
  );
}
