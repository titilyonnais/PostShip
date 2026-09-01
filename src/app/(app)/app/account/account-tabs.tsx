"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const VALID_TABS = new Set(["profile", "billing", "notifications", "danger"]);

export function AccountTabs({
  defaultTab,
  profile,
  billing,
  notifications,
  danger,
}: {
  defaultTab?: string;
  profile: ReactNode;
  billing: ReactNode;
  notifications: ReactNode;
  danger: ReactNode;
}) {
  const initialTab =
    defaultTab && VALID_TABS.has(defaultTab) ? defaultTab : "profile";

  return (
    <Tabs defaultValue={initialTab} className="gap-6">
      <TabsList variant="line">
        <TabsTrigger value="profile">Profil</TabsTrigger>
        <TabsTrigger value="billing">Facturation</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="danger">Zone dangereuse</TabsTrigger>
      </TabsList>
      <TabsContent value="profile">{profile}</TabsContent>
      <TabsContent value="billing">{billing}</TabsContent>
      <TabsContent value="notifications">{notifications}</TabsContent>
      <TabsContent value="danger">{danger}</TabsContent>
    </Tabs>
  );
}
