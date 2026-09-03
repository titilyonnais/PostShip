import type { SupabaseClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { escapeHtml, renderEmailShell } from "@/lib/email-template";

// Called right after a profile row is created/updated on both signup
// paths (src/app/auth/callback/route.ts for OAuth/magic-link,
// src/app/onboarding/actions.ts for password signups) — a pending
// invite's user_id is null until the invited person actually has an
// account, so this is what turns "invited by email" into "can now access
// the project."
export async function linkPendingProjectInvites(
  supabase: SupabaseClient, // service role — pending rows have no user_id yet, so no RLS policy would let the new user link themselves
  userId: string,
  email: string,
): Promise<void> {
  await supabase
    .from("project_members")
    .update({
      user_id: userId,
      status: "accepted",
      accepted_at: new Date().toISOString(),
    })
    .ilike("invited_email", email)
    .eq("status", "pending");
}

export async function sendProjectInviteEmail(params: {
  to: string;
  projectName: string;
  inviterEmail: string;
  hasAccount: boolean;
}): Promise<void> {
  const resend = new Resend(process.env.RESEND_API_KEY);
  const actionUrl = params.hasAccount
    ? `${process.env.NEXT_PUBLIC_APP_URL}/app`
    : `${process.env.NEXT_PUBLIC_APP_URL}/login`;
  const actionLabel = params.hasAccount ? "Voir le projet" : "Créer un compte";

  await resend.emails.send({
    from: process.env.RESEND_FROM!,
    to: params.to,
    subject: `[PostShip] ${params.inviterEmail} vous a invité sur ${params.projectName}`,
    text: `${params.inviterEmail} vous a ajouté comme collaborateur sur le projet « ${params.projectName} » dans PostShip.\n\n${actionLabel} : ${actionUrl}`,
    html: renderEmailShell({
      preheader: `${params.inviterEmail} vous a invité sur ${params.projectName}`,
      title: "Invitation à un projet",
      bodyHtml: `
        <p style="margin:0 0 16px;color:#e6edf3;font-size:14px;line-height:1.5;">
          <strong>${escapeHtml(params.inviterEmail)}</strong> vous a ajouté comme
          collaborateur sur le projet « ${escapeHtml(params.projectName)} ».
        </p>
        <a href="${actionUrl}" style="display:inline-block;background:#3fb950;color:#0a0c0e;font-size:13px;font-weight:600;text-decoration:none;padding:10px 18px;border-radius:10px;">${escapeHtml(actionLabel)}</a>
      `,
    }),
  });
}
