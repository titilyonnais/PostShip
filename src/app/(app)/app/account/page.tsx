import Link from "next/link";
import { Suspense } from "react";
import { AlertTriangle, Coins, Download } from "lucide-react";
import { ActionForm } from "@/components/action-form";
import { BackToProjectLink } from "@/components/back-to-project-link";
import { CheckoutReturnToast } from "@/components/checkout-return-toast";
import { Input } from "@/components/ui/input";
import { SubmitButton } from "@/components/submit-button";
import { avatarUrl } from "@/lib/avatar";
import { createClient } from "@/lib/db/server";
import { getPlanLimits, type Plan } from "@/lib/entitlements";
import { TOKEN_PACKS, type TokenPackId } from "@/lib/stripe";
import { AccountTabs } from "./account-tabs";
import { DeleteAccountButton } from "./delete-account-button";
import { EmailSection } from "./email-section";
import { IdentitySection } from "./identity-section";
import { LocaleSelect } from "./locale-select";
import { MfaSection } from "./mfa-section";
import { TeamSizeSelect } from "./team-size-select";
import {
  setPassword,
  updateBillingAddress,
  updateDisplayName,
  updateNotificationPrefs,
  updateProfile,
} from "./actions";
import { buyTokens } from "./tokens-actions";

const PLAN_LABEL: Record<Plan, string> = {
  free: "Free",
  solo: "Solo",
  team: "Team",
};

const TOKEN_PACK_IDS: TokenPackId[] = ["500", "1000", "5000"];

type BillingAddress = {
  line1?: string;
  line2?: string | null;
  city?: string;
  postal_code?: string;
  country?: string;
} | null;

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "email, display_name, username, avatar_seed, full_name, company_name, phone, team_size, plan, billing_address, stripe_customer_id, email_alerts_enabled, locale, token_balance",
    )
    .eq("id", user?.id)
    .single();

  const { data: factorsData } = await supabase.auth.mfa.listFactors();
  const totpFactor = factorsData?.totp?.[0] ?? null;

  const plan = (profile?.plan as Plan) ?? "free";
  const limits = getPlanLimits(plan);
  const billingAddress = (profile?.billing_address as BillingAddress) ?? null;
  const tokenBalance = profile?.token_balance ?? 0;
  const profileComplete = Boolean(profile?.full_name);

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-6 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-300">
      <Suspense fallback={null}>
        <CheckoutReturnToast />
        <BackToProjectLink />
      </Suspense>

      <div>
        <h1 className="text-lg font-semibold">Paramètres</h1>
        <p className="text-sm text-muted-foreground">
          {profile?.email ?? user?.email} — plan {PLAN_LABEL[plan]} (
          {limits.retentionDays} jours de rétention)
        </p>
      </div>

      <Suspense fallback={null}>
      <AccountTabs
        overview={
          <div className="flex flex-col gap-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Abonnement</p>
                <p className="mt-1 text-lg font-medium">{PLAN_LABEL[plan]}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {limits.projects} projet(s) · {limits.urls} URL(s)
                </p>
              </div>
              <div className="rounded-md border border-border bg-card p-4">
                <p className="text-xs text-muted-foreground">Tokens</p>
                <p className="mt-1 flex items-center gap-1.5 text-lg font-medium">
                  <Coins className="size-4 text-muted-foreground" aria-hidden="true" />
                  {tokenBalance}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Pour les scans complets de site
                </p>
              </div>
              <div className="flex items-center gap-3 rounded-md border border-border bg-card p-4">
                {/* eslint-disable-next-line @next/next/no-img-element -- external DiceBear SVG */}
                <img
                  src={avatarUrl(profile?.avatar_seed ?? user?.id ?? "", 64)}
                  alt=""
                  className="size-10 shrink-0 rounded-full bg-secondary"
                  width={40}
                  height={40}
                />
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">
                    {profile?.username || profile?.full_name || profile?.email}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {profileComplete ? "Profil complet" : "Profil à compléter"}
                  </p>
                </div>
              </div>
            </div>

            <div className="rounded-md border border-border bg-card p-4">
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Vos données
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Téléchargez une copie de votre profil, vos projets et vos URLs
                surveillées au format JSON.
              </p>
              <a
                href="/api/account/export"
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-foreground underline underline-offset-2"
              >
                <Download className="size-3.5" aria-hidden="true" />
                Exporter mes données
              </a>
            </div>
          </div>
        }
        profile={
          <div className="flex flex-col gap-6">
            <IdentitySection
              username={profile?.username ?? ""}
              avatarSeed={profile?.avatar_seed ?? user?.id ?? ""}
            />

            <ActionForm
              action={updateDisplayName}
              className="flex max-w-sm items-end gap-2"
            >
              <div className="flex flex-1 flex-col gap-1">
                <label
                  htmlFor="display-name"
                  className="text-xs text-muted-foreground"
                >
                  Nom affiché
                </label>
                <Input
                  id="display-name"
                  name="display_name"
                  defaultValue={profile?.display_name ?? ""}
                  placeholder="Optionnel"
                />
              </div>
              <SubmitButton variant="outline" pendingText="Enregistrement...">
                Enregistrer
              </SubmitButton>
            </ActionForm>

            <ActionForm action={updateProfile} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="full_name"
                  className="text-xs text-muted-foreground"
                >
                  Nom complet <span aria-hidden="true">*</span>
                </label>
                <Input
                  id="full_name"
                  name="full_name"
                  defaultValue={profile?.full_name ?? ""}
                  required
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="company_name"
                    className="text-xs text-muted-foreground"
                  >
                    Société
                  </label>
                  <Input
                    id="company_name"
                    name="company_name"
                    defaultValue={profile?.company_name ?? ""}
                    placeholder="Optionnel"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="phone"
                    className="text-xs text-muted-foreground"
                  >
                    Téléphone
                  </label>
                  <Input
                    id="phone"
                    name="phone"
                    type="tel"
                    defaultValue={profile?.phone ?? ""}
                    placeholder="Optionnel"
                  />
                </div>
              </div>
              <div className="flex flex-col gap-1">
                <label
                  htmlFor="team_size"
                  className="text-xs text-muted-foreground"
                >
                  Taille de l&apos;équipe
                </label>
                <TeamSizeSelect defaultValue={profile?.team_size ?? ""} />
              </div>
              <div>
                <SubmitButton pendingText="Enregistrement...">
                  Enregistrer le profil
                </SubmitButton>
              </div>
            </ActionForm>
          </div>
        }
        security={
          <div className="flex flex-col gap-6">
            <EmailSection currentEmail={profile?.email ?? user?.email ?? ""} />

            <div className="flex flex-col gap-2 border-t border-border pt-6">
              <h2 className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                Mot de passe
              </h2>
              <p className="text-xs text-muted-foreground">
                Définissez ou changez le mot de passe utilisé pour vous
                connecter sans lien magique ni Google/GitHub.
              </p>
              <ActionForm action={setPassword} className="flex max-w-sm gap-2">
                <label htmlFor="new-password" className="sr-only">
                  Nouveau mot de passe
                </label>
                <Input
                  id="new-password"
                  name="password"
                  type="password"
                  placeholder="8 caractères minimum"
                  minLength={8}
                  autoComplete="new-password"
                  className="flex-1"
                  required
                />
                <SubmitButton variant="outline" pendingText="...">
                  Définir
                </SubmitButton>
              </ActionForm>
            </div>

            <div className="border-t border-border pt-6">
              <MfaSection
                enabled={Boolean(totpFactor)}
                factorId={totpFactor?.id ?? null}
              />
            </div>
          </div>
        }
        billing={
          <div className="flex flex-col gap-6">
            <p className="text-sm text-muted-foreground">
              Plan actuel : {PLAN_LABEL[plan]}.{" "}
              <Link
                href="/app/billing"
                className="text-foreground underline underline-offset-2"
              >
                Gérer l&apos;abonnement
              </Link>
            </p>

            <ActionForm
              action={updateBillingAddress}
              className="flex flex-col gap-4"
            >
              <div className="flex flex-col gap-1">
                <label htmlFor="line1" className="text-xs text-muted-foreground">
                  Adresse <span aria-hidden="true">*</span>
                </label>
                <Input
                  id="line1"
                  name="line1"
                  defaultValue={billingAddress?.line1 ?? ""}
                  required
                />
              </div>
              <div className="flex flex-col gap-1">
                <label htmlFor="line2" className="text-xs text-muted-foreground">
                  Complément d&apos;adresse
                </label>
                <Input
                  id="line2"
                  name="line2"
                  defaultValue={billingAddress?.line2 ?? ""}
                  placeholder="Optionnel"
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <label htmlFor="city" className="text-xs text-muted-foreground">
                    Ville <span aria-hidden="true">*</span>
                  </label>
                  <Input
                    id="city"
                    name="city"
                    defaultValue={billingAddress?.city ?? ""}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="postal_code"
                    className="text-xs text-muted-foreground"
                  >
                    Code postal <span aria-hidden="true">*</span>
                  </label>
                  <Input
                    id="postal_code"
                    name="postal_code"
                    defaultValue={billingAddress?.postal_code ?? ""}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label
                    htmlFor="country"
                    className="text-xs text-muted-foreground"
                  >
                    Pays (code ISO) <span aria-hidden="true">*</span>
                  </label>
                  <Input
                    id="country"
                    name="country"
                    defaultValue={billingAddress?.country ?? ""}
                    placeholder="FR"
                    maxLength={2}
                    required
                  />
                </div>
              </div>
              <div>
                <SubmitButton pendingText="Enregistrement...">
                  Enregistrer l&apos;adresse
                </SubmitButton>
              </div>
            </ActionForm>
          </div>
        }
        notifications={
          <ActionForm
            action={updateNotificationPrefs}
            className="flex flex-col gap-5"
          >
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                name="email_alerts_enabled"
                defaultChecked={profile?.email_alerts_enabled ?? true}
                className="mt-0.5 size-3.5 rounded border-input accent-foreground"
              />
              <span>
                Recevoir les alertes par email
                <span className="block text-xs text-muted-foreground">
                  Discord (si configuré par projet) n&apos;est pas affecté par
                  ce réglage.
                </span>
              </span>
            </label>

            <div className="flex max-w-[12rem] flex-col gap-1">
              <label htmlFor="locale" className="text-xs text-muted-foreground">
                Langue de l&apos;interface
              </label>
              <LocaleSelect defaultValue={profile?.locale ?? "fr"} />
            </div>

            <div>
              <SubmitButton pendingText="Enregistrement...">
                Enregistrer les préférences
              </SubmitButton>
            </div>
          </ActionForm>
        }
        tokens={
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-1 rounded-md border border-border bg-card p-4">
              <span className="text-xs text-muted-foreground">
                Solde de tokens
              </span>
              <span className="flex items-center gap-2 font-mono text-2xl">
                <Coins className="size-5 text-muted-foreground" aria-hidden="true" />
                {tokenBalance}
              </span>
              <span className="text-xs text-muted-foreground">
                Indépendants de votre abonnement — 1 token = 1 page scannée
                lors d&apos;un scan complet de site, disponible depuis chaque
                projet.
              </span>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {TOKEN_PACK_IDS.map((packId) => {
                const pack = TOKEN_PACKS[packId];
                const highlight = packId === "1000";
                return (
                  <div
                    key={packId}
                    className={`flex flex-col gap-3 rounded-md border p-4 ${
                      highlight
                        ? "border-foreground/30 bg-card"
                        : "border-border"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="font-mono text-lg">{pack.tokens}</h3>
                      {highlight && (
                        <span className="rounded-full bg-secondary px-2 py-0.5 text-[0.65rem] text-muted-foreground">
                          Populaire
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      tokens — {pack.priceLabel}
                    </p>
                    <p className="flex-1 text-xs text-muted-foreground">
                      {pack.blurb}
                    </p>
                    <form action={buyTokens.bind(null, packId)}>
                      <SubmitButton
                        variant={highlight ? "default" : "outline"}
                        className="w-full"
                        pendingText="Redirection..."
                      >
                        Acheter — {pack.priceLabel}
                      </SubmitButton>
                    </form>
                  </div>
                );
              })}
            </div>
          </div>
        }
        danger={
          <div className="flex flex-col gap-2 rounded-md border border-destructive/30 bg-destructive/5 p-4">
            <h2 className="flex items-center gap-2 text-xs font-medium tracking-wide text-destructive uppercase">
              <AlertTriangle className="size-3.5" aria-hidden="true" />
              Zone dangereuse
            </h2>
            <p className="text-xs text-muted-foreground">
              Supprime définitivement votre compte, tous vos projets, targets
              et l&apos;historique des vérifications. Résilie aussi
              l&apos;abonnement Stripe actif s&apos;il y en a un.
            </p>
            <div>
              <DeleteAccountButton />
            </div>
          </div>
        }
      />
      </Suspense>
    </div>
  );
}
