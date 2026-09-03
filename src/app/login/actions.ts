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
const codeSchema = z
  .string()
  .trim()
  .regex(/^\d{6}$/, "Le code doit contenir 6 chiffres.");

export type EmailCodeState = {
  error: string | null;
  sent: boolean;
  email: string | null;
};

function nextPathFor(plan: string | null): string {
  return plan ? `/onboarding?plan=${plan}` : "/onboarding";
}

function loginErrorRedirect(plan: string | null, message: string): never {
  const params = new URLSearchParams({ error: message });
  if (plan) params.set("plan", plan);
  redirect(`/login?${params.toString()}`);
}

function signupErrorRedirect(plan: string, message: string): never {
  redirect(`/signup?${new URLSearchParams({ plan, error: message }).toString()}`);
}

function oauthErrorRedirect(origin: "login" | "signup", plan: string | null, provider: string): never {
  const params = new URLSearchParams({ error: provider });
  if (plan) params.set("plan", plan);
  redirect(`/${origin}?${params.toString()}`);
}

// Feedback fix: magic link replaced by a 6-digit email code — same
// Supabase call (signInWithOtp), but the app now shows a code-entry step
// instead of relying on the visitor clicking a link. Requires the
// Supabase project's "Magic Link" email template to include {{ .Token }}
// (Authentication → Email Templates in the Supabase dashboard) — that's
// dashboard config, not something this code can set.
//
// Always "succeeds" from the client's point of view regardless of whether
// the email is already registered — Supabase's own non-enumeration
// behavior for signInWithOtp — so there's no separate "if an account
// exists" messaging needed here.
export async function sendEmailCode(
  plan: string | null,
  _prevState: EmailCodeState,
  formData: FormData,
): Promise<EmailCodeState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) {
    return { error: "Adresse email invalide.", sent: false, email: null };
  }

  if (!(await checkAuthRateLimit())) {
    return { error: AUTH_RATE_LIMIT_MESSAGE, sent: false, email: null };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ email: parsed.data });

  if (error) {
    // Logged server-side for debugging; the client never sees Supabase's
    // actual error text here — same enumeration reasoning as signup below.
    console.error("Échec envoi du code", error);
  }

  return { error: null, sent: true, email: parsed.data };
}

export async function verifyEmailCode(
  plan: string | null,
  email: string,
  _prevState: EmailCodeState,
  formData: FormData,
): Promise<EmailCodeState> {
  const parsed = codeSchema.safeParse(formData.get("code"));
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Code invalide.",
      sent: true,
      email,
    };
  }

  if (!(await checkAuthRateLimit())) {
    return { error: AUTH_RATE_LIMIT_MESSAGE, sent: true, email };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    email,
    token: parsed.data,
    type: "email",
  });

  if (error) {
    return { error: "Code incorrect ou expiré.", sent: true, email };
  }

  redirect(nextPathFor(plan));
}

export async function signInWithPassword(plan: string | null, formData: FormData) {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = z.string().min(1).safeParse(formData.get("password"));

  if (!email.success || !password.success) {
    loginErrorRedirect(plan, "Email ou mot de passe invalide.");
  }

  if (!(await checkAuthRateLimit())) {
    loginErrorRedirect(plan, AUTH_RATE_LIMIT_MESSAGE);
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
      error.message === "Invalid login credentials"
        ? "Email ou mot de passe incorrect."
        : error.message,
    );
  }

  redirect(nextPathFor(plan));
}

export async function signUpWithPassword(plan: string, formData: FormData) {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = passwordSchema.safeParse(formData.get("password"));
  const termsAccepted = formData.get("terms_accepted") === "on";

  if (!email.success) {
    signupErrorRedirect(plan, "Adresse email invalide.");
  }
  if (!password.success) {
    signupErrorRedirect(
      plan,
      password.error.issues[0]?.message ?? "Mot de passe invalide.",
    );
  }
  if (!termsAccepted) {
    signupErrorRedirect(plan, CONSENT_ERROR);
  }

  if (!(await checkAuthRateLimit())) {
    signupErrorRedirect(plan, AUTH_RATE_LIMIT_MESSAGE);
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
    redirect(`/signup?${new URLSearchParams({ plan, confirm: "1" }).toString()}`);
  }

  redirect(nextPathFor(plan));
}

export async function signInWithGithub(
  plan: string | null,
  origin: "login" | "signup",
  _formData: FormData,
) {
  // OAuth can create an account on first login — consent for a genuinely
  // new one is still captured and enforced post-auth (see sendEmailCode's
  // comment above), not gated here.
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "github",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(nextPathFor(plan))}`,
    },
  });

  if (error || !data.url) {
    oauthErrorRedirect(origin, plan, "github");
  }

  redirect(data.url);
}

export async function signInWithGoogle(
  plan: string | null,
  origin: "login" | "signup",
  _formData: FormData,
) {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(nextPathFor(plan))}`,
    },
  });

  if (error || !data.url) {
    oauthErrorRedirect(origin, plan, "google");
  }

  redirect(data.url);
}
