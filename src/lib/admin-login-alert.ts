import { Resend } from "resend";
import { createServiceClient } from "@/lib/db/service";
import {
  escapeHtml,
  INSET_BG,
  renderEmailShell,
  RED,
  TEXT,
  TEXT_FAINT,
  TEXT_MUTED,
} from "@/lib/email-template";
import { formatDateTime } from "@/lib/timezone";

// A single-factor console needs a way to notice a login that wasn't you.
// The useful signal is not "someone logged in" — you log in all the time —
// it is "this login came from somewhere or something that has never
// signed in before", which is what the two flags below carry.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://postship.fr";

// Minimal, on purpose. A user-agent parser is a dependency that ships a
// regex database and updates monthly; what an alert needs is "Chrome on
// Windows, desktop", which is four checks.
export function describeUserAgent(ua: string): {
  browser: string;
  os: string;
  device: string;
} {
  const browser =
    /Edg\//.test(ua) ? "Edge"
    : /OPR\//.test(ua) ? "Opera"
    : /Firefox\//.test(ua) ? "Firefox"
    : /Chrome\//.test(ua) ? "Chrome"
    : /Safari\//.test(ua) ? "Safari"
    : /curl\//i.test(ua) ? "curl"
    : "inconnu";

  const os =
    /Windows NT 10/.test(ua) ? "Windows 10/11"
    : /Windows/.test(ua) ? "Windows"
    : /iPhone|iPad|iPod/.test(ua) ? "iOS"
    : /Mac OS X/.test(ua) ? "macOS"
    : /Android/.test(ua) ? "Android"
    : /Linux/.test(ua) ? "Linux"
    : "inconnu";

  const device = /Mobile|iPhone|iPod/.test(ua)
    ? "mobile"
    : /iPad|Tablet/.test(ua)
      ? "tablette"
      : "ordinateur";

  return { browser, os, device };
}

function row(label: string, value: string, tone?: "alert"): string {
  return `
    <tr>
      <td style="padding:6px 0;font-size:12px;color:${TEXT_MUTED};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;white-space:nowrap;">${escapeHtml(label)}</td>
      <td style="padding:6px 0 6px 16px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:12px;color:${tone === "alert" ? RED : TEXT};word-break:break-all;">${escapeHtml(value)}</td>
    </tr>`;
}

export type LoginAlertInput = {
  accountId: string;
  username: string;
  ip: string;
  userAgent: string;
  /** "success" for a completed login, "locked" when the account just locked. */
  kind: "success" | "locked";
};

export async function sendAdminLoginAlert(input: LoginAlertInput): Promise<void> {
  const to = process.env.ADMIN_ALERT_EMAIL;
  if (!to || !process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return;

  try {
    const supabase = createServiceClient();

    // Everything this account has ever signed in from, excluding the
    // session created moments ago by this very login.
    const { data: history } = await supabase
      .from("admin_sessions")
      .select("ip, user_agent, created_at")
      .eq("account_id", input.accountId)
      .order("created_at", { ascending: false })
      .limit(200);

    const previous = (history ?? []).slice(1);
    const knownIps = new Set(previous.map((s) => s.ip).filter(Boolean));
    const knownAgents = new Set(previous.map((s) => s.user_agent).filter(Boolean));

    // First ever login has no history to compare against, so nothing is
    // "new" — flagging it would cry wolf on the one login you expect.
    const firstEver = previous.length === 0;
    const newIp = !firstEver && !knownIps.has(input.ip);
    const newDevice = !firstEver && !knownAgents.has(input.userAgent);

    const ua = describeUserAgent(input.userAgent);
    const at = formatDateTime(new Date(), null, {
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const flags: string[] = [];
    if (newIp) flags.push("adresse IP jamais vue");
    if (newDevice) flags.push("appareil jamais vu");

    const locked = input.kind === "locked";
    const title = locked
      ? "Compte console verrouillé"
      : flags.length > 0
        ? "Connexion console depuis un nouvel accès"
        : "Connexion à la console";

    const intro = locked
      ? "Cinq tentatives de connexion ont échoué d'affilée : le compte est temporairement verrouillé. Si ce n'était pas vous, quelqu'un essaie de deviner le mot de passe."
      : flags.length > 0
        ? `Cette connexion vient d'un ${flags.join(" et d'une ")}. Si ce n'était pas vous, changez le mot de passe immédiatement.`
        : "Connexion réussie depuis un accès déjà connu.";

    const detail = `
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;background-color:${INSET_BG};border-radius:16px;padding:4px 16px;">
        ${row("Compte", input.username)}
        ${row("Quand", at)}
        ${row("Adresse IP", input.ip, newIp ? "alert" : undefined)}
        ${row("Appareil", `${ua.browser} · ${ua.os} · ${ua.device}`, newDevice ? "alert" : undefined)}
        ${row("Client complet", input.userAgent)}
      </table>
      <p style="margin:14px 0 0;font-size:11px;color:${TEXT_FAINT};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
        ${
          firstEver
            ? "Première connexion enregistrée : rien à comparer pour l'instant."
            : `Comparé à ${previous.length} connexion(s) précédente(s).`
        }
      </p>`;

    const resend = new Resend(process.env.RESEND_API_KEY);
    await resend.emails.send({
      from: process.env.RESEND_FROM,
      to,
      subject: `[PostShip] ${title}`,
      text: [
        title,
        intro,
        `Compte : ${input.username}`,
        `Quand : ${at}`,
        `IP : ${input.ip}${newIp ? " (nouvelle)" : ""}`,
        `Appareil : ${ua.browser} · ${ua.os} · ${ua.device}${newDevice ? " (nouveau)" : ""}`,
        input.userAgent,
      ].join("\n"),
      html: renderEmailShell({
        preheader: `${input.ip} · ${ua.browser} sur ${ua.os}`,
        eyebrow: at,
        title,
        intro,
        bodyHtml: detail,
        cta: { href: `${APP_URL}/admin/security`, label: "Ouvrir la sécurité de la console" },
      }),
    });
  } catch (err) {
    // A failed alert must never block or fail a legitimate login.
    console.error("Échec envoi de l'alerte de connexion console", err);
  }
}
