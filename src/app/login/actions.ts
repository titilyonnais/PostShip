"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/db/server";

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

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(nextPathFor(plan))}`,
    },
  });

  if (error) {
    return { error: error.message, sent: false };
  }

  return { error: null, sent: true };
}

export async function signInWithPassword(plan: string | null, formData: FormData) {
  const email = emailSchema.safeParse(formData.get("email"));
  const password = z.string().min(1).safeParse(formData.get("password"));

  if (!email.success || !password.success) {
    loginErrorRedirect(plan, "password", "Email ou mot de passe invalide.");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: email.data,
    password: password.data,
  });

  if (error) {
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

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: email.data,
    password: password.data,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/auth/callback?next=${encodeURIComponent(nextPathFor(plan))}`,
    },
  });

  if (error) {
    loginErrorRedirect(
      plan,
      "signup",
      error.message === "User already registered"
        ? "Un compte existe déjà avec cet email — connectez-vous plutôt."
        : error.message,
    );
  }

  // Email confirmation is on: no session yet, just a pending confirmation.
  if (!data.session) {
    const params = new URLSearchParams({ mode: "signup", confirm: "1" });
    if (plan) params.set("plan", plan);
    redirect(`/login?${params.toString()}`);
  }

  redirect(nextPathFor(plan));
}

export async function signInWithGithub(plan: string | null) {
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

export async function signInWithGoogle(plan: string | null) {
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
