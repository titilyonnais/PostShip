"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { buttonVariants } from "@/components/ui/button";
import { createClient } from "@/lib/db/client";
import { resolveAvatarUrl } from "@/lib/avatar";
import { ANONYMOUS_ONLY_SLOT_LABELS, getHeaderConfig, MEGA_MENUS, SECTION_LINKS } from "./header-config";
import { NavDropdown } from "./nav-dropdown";

type AuthState =
  | { loaded: false; loggedIn: false; label: null; avatarUrl: null }
  | { loaded: true; loggedIn: boolean; label: string | null; avatarUrl: string | null };

const INITIAL_AUTH_STATE: AuthState = {
  loaded: false,
  loggedIn: false,
  label: null,
  avatarUrl: null,
};

// Client-side on purpose (same trade-off as the old nav-auth.tsx it
// replaces): reading the session server-side would force every marketing
// page off static rendering.
function useMarketingAuth(): AuthState {
  const [state, setState] = useState<AuthState>(INITIAL_AUTH_STATE);

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function load() {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (active) setState({ loaded: true, loggedIn: false, label: null, avatarUrl: null });
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (active) setState({ loaded: true, loggedIn: false, label: null, avatarUrl: null });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_seed, avatar_url")
        .eq("id", user.id)
        .single();

      if (active) {
        setState({
          loaded: true,
          loggedIn: true,
          label: profile?.username || profile?.display_name || "Mon espace",
          avatarUrl: resolveAvatarUrl(profile, user.id),
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  return state;
}

const NAV_LINK_CLASS =
  "rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function isCurrentSection(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MarketingHeader() {
  const pathname = usePathname();
  const auth = useMarketingAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const config = getHeaderConfig(pathname, auth.loggedIn);

  // NavAuth's job, folded in: never show a second "Connexion" (or account
  // link) next to a slot that already does the same job (Commencer /
  // Prendre Solo / Ouvrir l'app) — see header-config's table. /login has
  // no auth link at all, the form is the only action on that page.
  const showAuthLink =
    pathname !== "/login" &&
    !(config.slot && (ANONYMOUS_ONLY_SLOT_LABELS as readonly string[]).includes(config.slot.label));

  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setDrawerOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [drawerOpen]);

  const authLinkHref = auth.loggedIn ? "/app" : "/login";
  const authLinkLabel = auth.loggedIn ? (auth.label ?? "Mon espace") : "Connexion";

  return (
    <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-10">
        <Link href="/" aria-label="PostShip, accueil">
          <LogoMark className="size-9" />
        </Link>

        <nav aria-label="Principale" className="hidden items-center gap-2 md:flex">
          {SECTION_LINKS.map((link) => {
            const active = isCurrentSection(pathname, link.href);
            const megaMenu = MEGA_MENUS[link.href];
            if (megaMenu) {
              return (
                <NavDropdown
                  key={link.href}
                  label={link.label}
                  href={link.href}
                  active={active}
                  items={megaMenu}
                />
              );
            }
            return active ? (
              <span
                key={link.href}
                aria-current="page"
                className="rounded-full px-3 py-1.5 text-sm font-medium text-foreground"
              >
                {link.label}
              </span>
            ) : (
              <Link key={link.href} href={link.href} className={NAV_LINK_CLASS}>
                {link.label}
              </Link>
            );
          })}
          {showAuthLink && (
            <Link href={authLinkHref} className={NAV_LINK_CLASS}>
              {auth.loggedIn && auth.avatarUrl ? (
                <span className="flex items-center gap-2">
                  {/* eslint-disable-next-line @next/next/no-img-element -- external avatar (DiceBear or the OAuth provider's own photo) */}
                  <img
                    src={auth.avatarUrl}
                    alt=""
                    className="size-5 rounded-full bg-secondary"
                    width={20}
                    height={20}
                  />
                  {authLinkLabel}
                </span>
              ) : (
                authLinkLabel
              )}
            </Link>
          )}
          {config.slot && (
            <Link href={config.slot.href} className={buttonVariants({ variant: "default" })}>
              {config.slot.label}
            </Link>
          )}
        </nav>

        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          aria-label="Ouvrir le menu"
          aria-expanded={drawerOpen}
          className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring md:hidden"
        >
          <Menu className="size-5" aria-hidden="true" />
        </button>
      </div>

      {drawerOpen && (
        <div className="md:hidden">
          <button
            type="button"
            aria-label="Fermer le menu"
            onClick={() => setDrawerOpen(false)}
            className="fixed inset-0 z-40 bg-black/40 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200"
          />
          <div className="fixed inset-x-0 top-[calc(4rem+1px)] bottom-0 z-50 flex flex-col overflow-y-auto bg-background px-6 py-4 motion-safe:animate-in motion-safe:fade-in motion-safe:duration-200">
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => setDrawerOpen(false)}
                aria-label="Fermer le menu"
                className="flex size-11 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="size-5" aria-hidden="true" />
              </button>
            </div>
            {SECTION_LINKS.map((link) =>
              isCurrentSection(pathname, link.href) ? (
                <span key={link.href} aria-current="page" className="py-3 text-lg font-medium text-foreground">
                  {link.label}
                </span>
              ) : (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setDrawerOpen(false)}
                  className="py-3 text-lg text-foreground"
                >
                  {link.label}
                </Link>
              ),
            )}
            {showAuthLink && (
              <Link
                href={authLinkHref}
                onClick={() => setDrawerOpen(false)}
                className="py-3 text-lg text-foreground"
              >
                {authLinkLabel}
              </Link>
            )}
            {config.slot && (
              <Link
                href={config.slot.href}
                onClick={() => setDrawerOpen(false)}
                className={`${buttonVariants({ variant: "default" })} mt-3 w-full`}
              >
                {config.slot.label}
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
