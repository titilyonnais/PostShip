"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import type { ActionResult } from "@/lib/use-toast-action";

export type EnrollTotpResult =
  | { ok: true; factorId: string; qrCode: string; secret: string }
  | { ok: false; error: string };

export async function enrollTotp(): Promise<EnrollTotpResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: "PostShip",
  });

  if (error || !data) {
    return {
      ok: false,
      error: error?.message ?? "Impossible d'activer la double authentification.",
    };
  }

  return {
    ok: true,
    factorId: data.id,
    qrCode: data.totp.qr_code,
    secret: data.totp.secret,
  };
}

export async function verifyTotpEnrollment(
  factorId: string,
  code: string,
): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: challenge, error: challengeError } =
    await supabase.auth.mfa.challenge({ factorId });

  if (challengeError || !challenge) {
    return { error: "Impossible de vérifier le code — réessayez." };
  }

  const { error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challenge.id,
    code,
  });

  if (error) return { error: "Code invalide." };

  return { success: "Double authentification activée." };
}

export async function cancelTotpEnrollment(factorId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  await supabase.auth.mfa.unenroll({ factorId });
  return { success: "Activation annulée." };
}

export async function unenrollTotp(factorId: string): Promise<ActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { error: error.message };

  return { success: "Double authentification désactivée." };
}
