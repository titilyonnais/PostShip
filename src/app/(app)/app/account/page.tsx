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

  // Every verified authenticator, not just the first: several devices is
  // the only recovery path Supabase offers (it has no backup codes).
  const totpFactors = (factorsData?.totp ?? [])
    .filter((factor) => factor.status === "verified")
    .map((factor) => ({
      id: factor.id,
      friendlyName: factor.friendly_name ?? null,
      createdAt: factor.created_at ?? null,
    }));

  // The email identity is filtered out: it isn't a sign-in method the
  // user can link or unlink, it's just the address, which the section
  // right below already owns.
  const identities = (user?.identities ?? [])
    .filter((identity) => identity.provider !== "email")
    .map((identity) => ({
      provider: identity.provider,
      email: (identity.identity_data?.email as string | undefined) ?? null,
      createdAt: identity.created_at ?? null,
    }));

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
            identities={identities}
            totpFactors={totpFactors}
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
