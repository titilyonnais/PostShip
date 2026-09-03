"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/db/client";
import { avatarUrl } from "@/lib/avatar";

type AuthState =
  | { loaded: false }
  | { loaded: true; label: string | null; avatarSeed: string | null };

// Client-side on purpose: reading the session server-side (cookies()) forced
// every marketing page to skip static rendering entirely, which is most of
// why the homepage was never served from Vercel's cache. This costs one
// small client-side round trip instead of blocking the whole page.
export function NavAuth() {
  const [state, setState] = useState<AuthState>({ loaded: false });

  useEffect(() => {
    let active = true;
    const supabase = createClient();

    async function load() {
      // getSession() reads local storage only, no network call — skips the
      // guaranteed-403 request to /auth/v1/user that getUser() makes for
      // the common case of an anonymous visitor with no session at all.
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        if (active) setState({ loaded: true, label: null, avatarSeed: null });
        return;
      }

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        if (active) setState({ loaded: true, label: null, avatarSeed: null });
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("username, display_name, avatar_seed")
        .eq("id", user.id)
        .single();

      if (active) {
        setState({
          loaded: true,
          label: profile?.username || profile?.display_name || "Mon espace",
          avatarSeed: profile?.avatar_seed ?? user.id,
        });
      }
    }

    load();
    return () => {
      active = false;
    };
  }, []);

  if (!state.loaded) {
    return <span className="inline-block h-5 w-16" aria-hidden="true" />;
  }

  if (!state.label) {
    return (
      <Link
        href="/login"
        className="rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        Connexion
      </Link>
    );
  }

  return (
    <Link
      href="/app"
      className="flex items-center gap-2 rounded-full px-3 py-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground focus-visible:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- external DiceBear SVG */}
      <img
        src={avatarUrl(state.avatarSeed ?? "")}
        alt=""
        className="size-5 rounded-full bg-secondary"
        width={20}
        height={20}
      />
      {state.label}
    </Link>
  );
}
