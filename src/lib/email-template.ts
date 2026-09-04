// Feedback fix (round 3): round 2's bulletproof-table approach still
// rendered as a plain white card with dark text in real Gmail apps (iOS
// screenshots from the user) — Gmail's own automatic "dark theme"
// conversion inspects emails that don't unambiguously opt out and can
// rewrite backgrounds it doesn't recognize, even when they're already
// painted via bgcolor/style on tables. The one thing that reliably
// survives that pass, per every major bulletproof-dark-email writeup, is
// a real <style> block in <head> using !important on classed selectors —
// Gmail's injected dark-mode CSS has lower priority than an author
// stylesheet's !important rule. So every color in this file is now
// declared BOTH inline (for clients that strip <style>, e.g. old
// Outlook) AND as a class hooked into that stylesheet (to beat Gmail).
// We never offer a light variant — the product itself is dark-only
// (CLAUDE.md), so colors are forced regardless of the client's
// prefers-color-scheme instead of branching on it.
import { LEGAL } from "@/lib/legal";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://postship.fr";
const LOGO_URL = `${APP_URL}/apple-icon.png`;

// Exact dark-theme tokens from src/app/globals.css — the email should
// look like a screenshot of the app, not an approximation of it.
export const BG = "#0a0c0e";
export const CARD = "#101317";
export const STAT_CARD = "#161b1f";
export const BORDER = "#21262d";
export const FG = "#e6e8eb";
export const MUTED = "#8b949e";
export const FOOTNOTE = "#565d66";
export const PRIMARY_BG = "#e6e8eb";
export const PRIMARY_FG = "#0a0c0e";
export const BRAND_GREEN = "#3fb950";
export const LINK_BLUE = "#58a6ff";

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,monospace";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Shared <style> block, injected once per email — the forced-dark
// !important layer described above. Kept as a standalone export so the
// 4 hand-written Supabase-native templates (pushed via the Management
// API, not through renderEmailShell) can inline the exact same rules.
export const EMAIL_DARK_STYLE = `:root { color-scheme: dark; supported-color-schemes: dark; }
    body, .bg-page { background-color:${BG} !important; }
    .bg-card { background-color:${CARD} !important; }
    .bg-stat { background-color:${STAT_CARD} !important; }
    .fg-primary, h1, h2, p, span, td { color:${FG}; }
    .fg-muted { color:${MUTED} !important; }
    .fg-footnote { color:${FOOTNOTE} !important; }
    .border-card { border-color:${BORDER} !important; }
    .btn-bg { background-color:${PRIMARY_BG} !important; }
    .btn-fg { color:${PRIMARY_FG} !important; }
    a.link { color:${LINK_BLUE} !important; }
    @media (prefers-color-scheme: light) {
      body, .bg-page { background-color:${BG} !important; }
      .bg-card { background-color:${CARD} !important; }
      .bg-stat { background-color:${STAT_CARD} !important; }
    }`;

// A real (light, dark-text) button matching buttonVariants({variant:
// "default"}) in the app, built as a table so padding/background render
// consistently across email clients instead of a bare styled <a>.
export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
  <tr>
    <td bgcolor="${PRIMARY_BG}" class="btn-bg" style="background-color:${PRIMARY_BG};border-radius:16px;">
      <a href="${href}" class="btn-fg" style="display:inline-block;padding:12px 24px;color:${PRIMARY_FG};font-size:13px;font-weight:600;text-decoration:none;font-family:${FONT};">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

export function renderEmailShell(opts: {
  preheader?: string;
  eyebrow?: string;
  title: string;
  intro?: string;
  bodyHtml: string;
  /** Defaults to "Gérer les notifications" -> /app/account?tab=notifications. */
  footerReason?: string;
  /** Shown in the footer as "Envoyé à …" — the professional, transparent
   * touch of naming exactly who and why, same as Stripe/Linear/GitHub
   * transactional mail. Omit for pre-account emails (invites to people
   * without an account yet). */
  recipientEmail?: string;
}): string {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <meta name="theme-color" content="${BG}" />
    <title>${escapeHtml(opts.title)}</title>
    <style>${EMAIL_DARK_STYLE}</style>
  </head>
  <body class="bg-page" style="margin:0;padding:0;background-color:${BG};">
    ${
      opts.preheader
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>`
        : ""
    }
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${BG}" class="bg-page" style="background-color:${BG};">
      <tr>
        <td align="center" style="padding:44px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;border-collapse:collapse;">
            <tr>
              <td style="padding-bottom:28px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="width:36px;height:36px;">
                      <img
                        src="${LOGO_URL}"
                        width="36"
                        height="36"
                        alt="PostShip"
                        style="display:block;width:36px;height:36px;border-radius:9px;"
                      />
                    </td>
                    <td style="padding-left:12px;" valign="middle">
                      <span class="fg-primary" style="color:${FG};font-size:17px;font-weight:600;letter-spacing:-0.01em;font-family:${FONT};">PostShip</span>
                      ${
                        opts.eyebrow
                          ? `<br /><span class="fg-muted" style="color:${MUTED};font-size:11px;font-family:${MONO};letter-spacing:0.02em;">${escapeHtml(opts.eyebrow)}</span>`
                          : ""
                      }
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td bgcolor="${CARD}" class="bg-card border-card" style="background-color:${CARD};border:1px solid ${BORDER};border-top:3px solid ${BRAND_GREEN};border-radius:24px;padding:32px;">
                <h1 class="fg-primary" style="margin:0 0 10px;color:${FG};font-size:19px;font-weight:600;font-family:${FONT};">${escapeHtml(opts.title)}</h1>
                ${
                  opts.intro
                    ? `<p class="fg-muted" style="margin:0 0 24px;color:${MUTED};font-size:13px;line-height:1.6;font-family:${FONT};">${escapeHtml(opts.intro)}</p>`
                    : ""
                }
                ${opts.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding-top:24px;text-align:center;">
                <a href="${APP_URL}/app" class="link" style="color:${MUTED};font-size:12px;text-decoration:none;font-family:${FONT};">Ouvrir PostShip</a>
                <span style="color:${BORDER};"> &middot; </span>
                <a href="${APP_URL}/app/account?tab=notifications" class="link" style="color:${MUTED};font-size:12px;text-decoration:none;font-family:${FONT};">${escapeHtml(opts.footerReason ?? "Gérer les notifications")}</a>
              </td>
            </tr>
            <tr>
              <td style="padding-top:18px;">
                <p class="fg-footnote" style="margin:0;text-align:center;color:${FOOTNOTE};font-size:11px;line-height:1.7;font-family:${FONT};">
                  Surveillance post-d&eacute;ploiement pour sites et SaaS indie.<br />
                  ${
                    opts.recipientEmail
                      ? `Envoy&eacute; &agrave; ${escapeHtml(opts.recipientEmail)} &mdash; <a href="${APP_URL}/app/account?tab=notifications" class="link" style="color:${FOOTNOTE};text-decoration:underline;">g&eacute;rer mes emails</a><br />`
                      : ""
                  }
                  PostShip &mdash; ${escapeHtml(LEGAL.editorName)} &mdash; ${escapeHtml(LEGAL.address)}<br />
                  Besoin d'aide&nbsp;? <a href="mailto:${LEGAL.publicEmailFallback}" class="link" style="color:${FOOTNOTE};text-decoration:underline;">${LEGAL.publicEmailFallback}</a><br />
                  <a href="${APP_URL}/terms" class="link" style="color:${FOOTNOTE};text-decoration:underline;">CGU</a>
                  &middot;
                  <a href="${APP_URL}/privacy" class="link" style="color:${FOOTNOTE};text-decoration:underline;">Confidentialit&eacute;</a>
                  &middot;
                  <a href="${APP_URL}/cgv" class="link" style="color:${FOOTNOTE};text-decoration:underline;">CGV</a>
                </p>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
