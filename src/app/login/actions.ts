"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { AUTH_RATE_LIMIT_MESSAGE, checkAuthRateLimit } from "@/lib/auth-rate-limit";
import { createClient } from "@/lib/db/server";
import { createServiceClient } from "@/lib/db/service";
import { CURRENT_PRIVACY_VERSION, CURRENT_TERMS_VERSION } from "@/lib/legal";
import { CONSENT_ERROR } from "./messages";

const emailSchema = z.string().email();
const passwordSchema = z.string().min(8, "8 caractères minimum.");

export type MagicLinkState = { error: string | null; sent: boolean };

function nextPathFor(plan: string | null): string {
  return plan ? `/onboarding?plan=${plan}` : "/onboarding";
}

function loginErrorRedirect(
  plan: string | null,
  mode: "password" | "signup",
  message: string,
): never {
  const params = new URLSearchParams({ mode, error: message });
  if (plan) params.set("plan", plan);
  redirect(`/login?${params.toString()}`);
}

export async function signInWithMagicLink(
  plan: string | null,
  _prevState: MagicLinkState,
  formData: FormData,
): Promise<MagicLinkState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: "Adresse email invalide.", sent: false };
  }

  // Magic link can create an account (Supabase auto-signup on first OTP) —
  // unlike password signup, there's no separate confirmation step to pair
  // a checkbox with, and blocking *sign-in* behind one is bad UX for an
  // existing user. Consent for a genuinely new account is still captured
  // and enforced: middleware + /auth/callback redirect anyone without
  // profiles.terms_accepted_at to /accept-terms before /app or
  // /onboarding, whichever path got them a session.
  if (!(await checkAuthRateLimit())) {
    return { error: AUTH_RATE_LIMIT_MESSAGE, sent: false };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(nextPathFor(plan))}`,
    },
  });

  if (error) {
    // Logged server-side for debugging; the client never sees Supabase's
    // actual error text here — same enumeration reasoning as signup below.
    console.error("Échec envoi lien magique", error);
  }

  return { error: null, sent: true };
}

export async function signInWithPassword(plan: string | null, formData: FormData) {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = z.string().min(1).safeParse(formData.get("password"));

  if (!email.success || !password.success) {
    loginErrorRedirect(plan, "password", "Email ou mot de passe invalide.");
  }

  if (!(await checkAuthRateLimit())) {
    loginErrorRedirect(plan, "password", AUTH_RATE_LIMIT_MESSAGE);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password: password.data,
  });

  if (error) {
    // Supabase's own "Invalid login credentials" already doesn't
    // distinguish a wrong password from no account at that email — kept
    // as-is, no further masking needed here.
    loginErrorRedirect(
      plan,
      "password",
      error.message === "Invalid login credentials"
        ? "Email ou mot de passe incorrect."
        : error.message,
    );
  }

  redirect(nextPathFor(plan));
}

export async function signUpWithPassword(plan: string | null, formData: FormData) {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = passwordSchema.safeParse(formData.get("password"));
  const termsAccepted = formData.get("terms_accepted") === "on";

  if (!email.success) {
    loginErrorRedirect(plan, "signup", "Adresse email invalide.");
  }
  if (!password.success) {
    loginErrorRedirect(
      plan,
      "signup",
      password.error.issues[0]?.message ?? "Mot de passe invalide.",
    );
  }
  if (!termsAccepted) {
    loginErrorRedirect(plan, "signup", CONSENT_ERROR);
  }

  if (!(await checkAuthRateLimit())) {
    loginErrorRedirect(plan, "signup", AUTH_RATE_LIMIT_MESSAGE);
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.data,
    password: password.data,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(nextPathFor(plan))}`,
    },
  });

  if (error) {
    // No longer distinguishes "already registered" from any other
    // signup failure in what's shown to the client (logged server-side
    // instead) — see GENERIC_AUTH_MESSAGE above. Falls through to the
    // same confirm screen as a genuine new signup.
    console.error("Échec signUp", error);
  }

  // Traceable record of consent — written via the service client because at
  // this point (signUp just returned) there may be no session yet if email
  // confirmation is required, so the user's own client isn't authenticated.
  if (data.user) {
    await createServiceClient()
      .from("profiles")
      .upsert({
        id: data.user.id,
        email: email.data,
        terms_accepted_at: new Date().toISOString(),
        terms_version: CURRENT_TERMS_VERSION,
        privacy_version: CURRENT_PRIVACY_VERSION,
      });
  }

  // Always the same outcome screen, whether this was a genuine new
  // account, a retry against an already-registered email, or a Supabase
  // error — see GENERIC_AUTH_MESSAGE.
  if (!data.session) {
    const params = new URLSearchParams({ mode: "signup", confirm: "1" });
    if (plan) params.set("plan", plan);
    redirect(`/login?${params.toString()}`);
  }

  redirect(nextPathFor(plan));
}

export async function signInWithGithub(plan: string | null, _formData: FormData) {
  // OAuth can create an account on first login — consent for a genuinely
  // new one is still captured and enforced post-auth (see the comment on
  // signInWithMagicLink above), not gated here.
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(nextPathFor(plan))}`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=github");
  }

  redirect(data.url);
}

export async function signInWithGoogle(plan: string | null, _formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(nextPathFor(plan))}`,
    },
  });

  if (error || !data.url) {
    redirect("/login?error=google");
  }

  redirect(data.url);
}
