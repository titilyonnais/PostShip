"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/db/server";
import type { ActionResult } from "@/lib/use-toast-action";

export type EnrollTotpResult =
  | { ok: true; factorId: string; qrCode: string; secret: string }
  | { ok: false; error: string };

// Supabase allows several TOTP factors per user, and that is its whole
// recovery story: there are no backup codes in the platform, so a second
// enrolled device is what stands between a lost phone and a support
// request. Hence the friendly name — "PostShip" on every factor made them
// indistinguishable in the list, which made a second one pointless.
export async function enrollTotp(friendlyName: string): Promise<EnrollTotpResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const name = friendlyName.trim().slice(0, 40) || "Mon appareil";

  // Supabase rejects a duplicate friendly name outright; saying which name
  // is taken beats surfacing its raw error.
  const { data: existing } = await supabase.auth.mfa.listFactors();
  if ((existing?.totp ?? []).some((f) => f.friendly_name === name)) {
    return { ok: false, error: `Un appareil s'appelle déjà « ${name} ».` };
  }

  const { data, error } = await supabase.auth.mfa.enroll({
    factorType: "totp",
    friendlyName: name,
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

  return { success: "Appareil vérifié — la double authentification est active." };
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

  const { data: factors } = await supabase.auth.mfa.listFactors();
  const verified = (factors?.totp ?? []).filter((f) => f.status === "verified");

  const { error } = await supabase.auth.mfa.unenroll({ factorId });
  if (error) return { error: error.message };

  return {
    success:
      verified.length <= 1
        ? "Double authentification désactivée."
        : "Appareil retiré.",
  };
}
