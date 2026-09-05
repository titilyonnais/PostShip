"use client";

import { useEffect, useRef } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

// Same job as CheckoutReturnToast, for the ?connected= / ?oauth_error=
// the Discord and Slack callbacks bounce back to Intégrations. These used
// to render as a green or red line pinned above the cards, which is not
// how anything else in the app reports the outcome of an action — every
// other one is a toast. It also never went away: the message stayed until
// the next navigation, long after it meant anything.
const CONNECTED: Record<string, string> = {
  discord: "Discord connecté.",
  slack: "Slack connecté.",
  github: "App GitHub installée — indiquez maintenant le dépôt.",
};

const OAUTH_ERROR: Record<string, string> = {
  plan: "Ce plan ne donne pas accès à cette intégration.",
  discord: "Échec de la connexion à Discord — réessayez ou collez l'URL manuellement.",
  slack: "Échec de la connexion à Slack — réessayez ou collez l'URL manuellement.",
  discord_not_configured: "Connexion Discord pas encore activée sur ce site.",
  slack_not_configured: "Connexion Slack pas encore activée sur ce site.",
  github: "Échec de l'installation GitHub — réessayez ou collez un token.",
  github_not_configured: "App GitHub pas encore activée sur ce site.",
  github_pending: "Installation GitHub en attente d'approbation par un propriétaire de l'organisation.",
};

// Returned by /api/account/link/[provider] when the redirect to the
// provider never happens.
const LINK_ERROR: Record<string, string> = {
  unsupported: "Ce fournisseur ne peut pas être lié.",
  already_linked: "Ce compte est déjà lié.",
  google: "Échec de la liaison du compte Google — réessayez.",
  github: "Échec de la liaison du compte GitHub — réessayez.",
};

export function OAuthReturnToast() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    const connected = searchParams.get("connected");
    const oauthError = searchParams.get("oauth_error");
    const linkError = searchParams.get("link_error");
    if (!connected && !oauthError && !linkError) return;

    handled.current = true;
    if (connected) {
      toast.success(CONNECTED[connected] ?? "Intégration connectée.");
    } else if (oauthError) {
      toast.error(OAUTH_ERROR[oauthError] ?? "Échec de la connexion.");
    } else if (linkError) {
      toast.error(LINK_ERROR[linkError] ?? "Échec de la liaison du compte.");
    }

    // Drop only our own params, so a ?tab= or anything else the page
    // relies on survives the rewrite.
    const rest = new URLSearchParams(searchParams);
    rest.delete("connected");
    rest.delete("oauth_error");
    rest.delete("link_error");
    const query = rest.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [pathname, router, searchParams]);

  return null;
}
