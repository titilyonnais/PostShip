"use client";

import type { ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const VALID_TABS = new Set([
  "overview",
  "profile",
  "security",
  "billing",
  "notifications",
  "tokens",
  "danger",
]);

export function AccountTabs({
  overview,
  profile,
  security,
  billing,
  notifications,
  tokens,
  danger,
}: {
  overview: ReactNode;
  profile: ReactNode;
  security: ReactNode;
  billing: ReactNode;
  notifications: ReactNode;
  tokens: ReactNode;
  danger: ReactNode;
}) {
  const searchParams = useSearchParams();
  const requested = searchParams.get("tab");
  const initialTab = requested && VALID_TABS.has(requested) ? requested : "overview";

  return (
    <Tabs defaultValue={initialTab} className="gap-6">
      <TabsList variant="line">
        <TabsTrigger value="overview">Vue d&apos;ensemble</TabsTrigger>
        <TabsTrigger value="profile">Profil</TabsTrigger>
        <TabsTrigger value="security">Sécurité</TabsTrigger>
        <TabsTrigger value="billing">Facturation</TabsTrigger>
        <TabsTrigger value="notifications">Notifications</TabsTrigger>
        <TabsTrigger value="tokens">Tokens</TabsTrigger>
        <TabsTrigger value="danger">Zone dangereuse</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">{overview}</TabsContent>
      <TabsContent value="profile">{profile}</TabsContent>
      <TabsContent value="security">{security}</TabsContent>
      <TabsContent value="billing">{billing}</TabsContent>
      <TabsContent value="notifications">{notifications}</TabsContent>
      <TabsContent value="tokens">{tokens}</TabsContent>
      <TabsContent value="danger">{danger}</TabsContent>
    </Tabs>
  );
}
