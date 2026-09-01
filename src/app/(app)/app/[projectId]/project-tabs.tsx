"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function ProjectTabs({
  overview,
  settings,
}: {
  overview: ReactNode;
  settings: ReactNode;
}) {
  return (
    <Tabs defaultValue="overview" className="gap-6">
      <TabsList variant="line">
        <TabsTrigger value="overview">Aperçu</TabsTrigger>
        <TabsTrigger value="settings">Paramètres</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">{overview}</TabsContent>
      <TabsContent value="settings">{settings}</TabsContent>
    </Tabs>
  );
}
