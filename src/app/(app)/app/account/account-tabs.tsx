"use client";

import type { ReactNode } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

export function AccountTabs({
  profile,
  billing,
  notifications,
  tokens,
  danger,
}: {
  profile: ReactNode;
  billing: ReactNode;
  notifications: ReactNode;
  tokens: ReactNode;
  danger: ReactNode;
}) {
  return (
    <Tabs defaultValue="profile" className="gap-6">
      <TabsList variant="line">
        <TabsTrigger value="profile">Profil</TabsTrigger>
        <TabsTrigger value="billing">Facturation</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="tokens">Tokens</TabsTrigger>
        <TabsTrigger value="danger">Zone dangereuse</TabsTrigger>
      </TabsList>
      <TabsContent value="profile">{profile}</TabsContent>
      <TabsContent value="billing">{billing}</TabsContent>
      <TabsContent value="notifications">{notifications}</TabsContent>
      <TabsContent value="tokens">{tokens}</TabsContent>
      <TabsContent value="danger">{danger}</TabsContent>
    </Tabs>
  );
}
