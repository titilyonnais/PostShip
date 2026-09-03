import { createClient } from "@/lib/db/server";
import { getAuthUser, getProfile } from "@/lib/db/loaders";
import { type Plan } from "@/lib/entitlements";
import { AccountTabsHub } from "./account-tabs";
import { BillingAddressTab } from "./billing-address-tab";
import { DangerTab } from "./danger-tab";
import { NotificationsTab } from "./notifications-tab";
import { OverviewTab } from "./overview-tab";
import { ProfileTab } from "./profile-tab";
import { SecurityTab } from "./security-tab";
import { TokensTab } from "./tokens-tab";
import type { AccountTabSlug } from "@/components/sidebar/nav-config";

export const metadata = {
  title: "Compte",
};

const VALID_TABS: AccountTabSlug[] = [
  "overview",
  "profile",
  "security",
  "notifications",
  "tokens",
  "billing",
  "danger",
];

function parseTab(raw: string | undefined): AccountTabSlug {
  return VALID_TABS.includes(raw as AccountTabSlug) ? (raw as AccountTabSlug) : "overview";
}

type BillingAddress = {
  line1?: string;
  line2?: string | null;
  city?: string;
  postal_code?: string;
  country?: string;
} | null;

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { tab: rawTab } = await searchParams;
  const tab = parseTab(rawTab);

  const supabase = await createClient();
  const [user, { data: factorsData }] = await Promise.all([
    getAuthUser(),
    supabase.auth.mfa.listFactors(),
  ]);
  const profile = user ? await getProfile(user.id) : null;

  const linkedProviders = (user?.identities ?? [])
    .map((identity) => identity.provider)
    .filter((provider) => provider !== "email");

  return (
    <AccountTabsHub
      initialTab={tab}
      panels={{
        overview: (
          <OverviewTab
            userId={user?.id ?? ""}
            profile={profile}
          />
        ),
        profile: <ProfileTab profile={profile} />,
        security: (
          <SecurityTab
            email={profile?.email ?? user?.email ?? ""}
            linkedProviders={linkedProviders}
            mfaEnabled={Boolean(factorsData?.totp?.[0])}
            mfaFactorId={factorsData?.totp?.[0]?.id ?? null}
          />
        ),
        notifications: (
          <NotificationsTab
            emailAlertsEnabled={profile?.email_alerts_enabled ?? true}
            locale={profile?.locale ?? "fr"}
          />
        ),
        tokens: <TokensTab tokenBalance={profile?.token_balance ?? 0} />,
        billing: (
          <BillingAddressTab
            plan={(profile?.plan as Plan) ?? "free"}
            billingAddress={(profile?.billing_address as BillingAddress) ?? null}
          />
        ),
        danger: <DangerTab />,
      }}
    />
  );
}
