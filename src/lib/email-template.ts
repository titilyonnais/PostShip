// Feedback fix (round 2): the first branded shell used approximate dark
// colors and a plain <a> button in solid green — didn't actually match
// the site's own tokens (src/app/globals.css' dark theme), and relied on
// <body style="background"> alone, which Outlook and some other clients
// strip entirely, leaving a white/illegible email regardless of what the
// CSS says. This version:
//   - uses the exact dark-theme tokens (background/card/border/primary),
//     the same ones the app itself renders with
//   - paints the background via bgcolor attributes on wrapping tables,
//     not just body CSS, and declares color-scheme so clients that
//     auto-adapt light/dark don't try to invert it
//   - the button matches the site's real primary Button (light pill,
//     dark text) instead of a green button — green is reserved for
//     actual "healthy/recovered" status, same as everywhere else in the
//     product (CLAUDE.md's green/amber/red vocabulary)
//   - a table-based bulletproof button and richer per-section spacing
import { LEGAL } from "@/lib/legal";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://postship.fr";
const LOGO_URL = `${APP_URL}/apple-icon.png`;

// Exact dark-theme tokens from src/app/globals.css — the email should
// look like a screenshot of the app, not an approximation of it.
const BG = "#0a0c0e";
const CARD = "#101317";
const BORDER = "#21262d";
const FG = "#e6e8eb";
const MUTED = "#8b949e";
const FOOTNOTE = "#565d66";
const PRIMARY_BG = "#e6e8eb";
const PRIMARY_FG = "#0a0c0e";
const BRAND_GREEN = "#3fb950";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// A real (light, dark-text) button matching buttonVariants({variant:
// "default"}) in the app, built as a table so padding/background render
// consistently across email clients instead of a bare styled <a>.
export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
  <tr>
    <td bgcolor="${PRIMARY_BG}" style="background:${PRIMARY_BG};border-radius:16px;">
      <a href="${href}" style="display:inline-block;padding:11px 22px;color:${PRIMARY_FG};font-size:13px;font-weight:600;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escapeHtml(label)}</a>
    </td>
  </tr>
</table>`;
}

export function renderEmailShell(opts: {
  preheader?: string;
  title: string;
  intro?: string;
  bodyHtml: string;
  /** Defaults to "Gérer les notifications" -> /app/account?tab=notifications. */
  footerReason?: string;
}): string {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <meta name="supported-color-schemes" content="dark" />
    <title>${escapeHtml(opts.title)}</title>
  </head>
  <body style="margin:0;padding:0;background:${BG};">
    ${
      opts.preheader
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>`
        : ""
    }
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${BG}" style="background:${BG};">
      <tr>
        <td align="center" style="padding:44px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:540px;border-collapse:collapse;">
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
                    <td style="padding-left:12px;">
                      <span style="color:${FG};font-size:17px;font-weight:600;letter-spacing:-0.01em;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">PostShip</span>
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td bgcolor="${CARD}" style="background:${CARD};border:1px solid ${BORDER};border-top:3px solid ${BRAND_GREEN};border-radius:24px;padding:32px;">
                <h1 style="margin:0 0 10px;color:${FG};font-size:19px;font-weight:600;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escapeHtml(opts.title)}</h1>
                ${
                  opts.intro
                    ? `<p style="margin:0 0 24px;color:${MUTED};font-size:13px;line-height:1.6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escapeHtml(opts.intro)}</p>`
                    : ""
                }
                ${opts.bodyHtml}
              </td>
            </tr>
            <tr>
              <td style="padding-top:24px;text-align:center;">
                <a href="${APP_URL}/app" style="color:${MUTED};font-size:12px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">Ouvrir PostShip</a>
                <span style="color:${BORDER};"> &middot; </span>
                <a href="${APP_URL}/app/account?tab=notifications" style="color:${MUTED};font-size:12px;text-decoration:none;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">${escapeHtml(opts.footerReason ?? "Gérer les notifications")}</a>
              </td>
            </tr>
            <tr>
              <td style="padding-top:18px;">
                <p style="margin:0;text-align:center;color:${FOOTNOTE};font-size:11px;line-height:1.7;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                  Surveillance post-d&eacute;ploiement pour sites et SaaS indie.<br />
                  PostShip &mdash; ${escapeHtml(LEGAL.editorName)} &mdash; ${escapeHtml(LEGAL.address)}<br />
                  <a href="${APP_URL}/terms" style="color:${FOOTNOTE};text-decoration:underline;">CGU</a>
                  &middot;
                  <a href="${APP_URL}/privacy" style="color:${FOOTNOTE};text-decoration:underline;">Confidentialit&eacute;</a>
                  &middot;
                  <a href="${APP_URL}/cgv" style="color:${FOOTNOTE};text-decoration:underline;">CGV</a>
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
