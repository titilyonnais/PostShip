// Round 5 — the actual fix, after three wrong rounds.
//
// Gmail's mobile app (iOS especially) applies a FULL color inversion to
// every email when the user runs the dark theme, and it ignores
// color-scheme / supported-color-schemes meta tags entirely. There is no
// CSS that opts out of it — !important, classed selectors and
// body-placed <style> blocks all lose, because the inversion happens
// after the CSS is resolved.
//
// That means an email authored dark arrives LIGHT (which is exactly the
// bug we kept chasing: #0a0c0e background rendered near-white, #e6e8eb
// text rendered near-black — a literal inversion). The proof is in how
// GitHub's and Discord's emails look in the same inbox: dark, with their
// raster images still bright — because images are NOT inverted, only
// CSS colors. Those senders author LIGHT emails and let Gmail flip them.
//
// So this file now authors light, choosing values whose inversion lands
// on the app's own dark palette:
//
//   authored           inverts to (Gmail dark)      matches
//   #ffffff page   ->  near-black                   --background #0a0c0e
//   #f6f8fa card   ->  dark grey, lighter than page --card      #101317
//   #0a0c0e text   ->  near-white                   --foreground #e6e8eb
//   #0a0c0e button ->  light pill, dark label       the app's primary Button
//
// Status hues (#f85149 / #3fb950 / #d29922) are saturated, so they
// survive inversion with their meaning intact — same as GitHub's green
// button staying green. In a light-themed client the email simply reads
// as a clean light email, which is what every other major SaaS ships.
//
// Borders are gone throughout: separation comes from flat background
// steps and whitespace instead (they read as hard outlines once
// inverted, which is what "le contour dégueulasse" was).
//
// The footer carries links only — no editor name, no postal address.
// /mentions-legales holds those, so linking it satisfies the legal
// obligation without printing a home address into every inbox.

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://postship.fr";
const LOGO_URL = `${APP_URL}/apple-icon.png`;

// Authored-light palette. Each name says what it becomes after Gmail's
// inversion, since that's the rendering the product is tuned for.
export const PAGE_BG = "#ffffff"; // -> near-black page
export const CARD_BG = "#f6f8fa"; // -> card, one step lighter than page
export const INSET_BG = "#eceff2"; // -> stat/code block, one step lighter again
export const TEXT = "#0a0c0e"; // -> near-white
export const TEXT_MUTED = "#5b6570"; // -> light grey, contrast-safe both ways
export const TEXT_FAINT = "#6b7480"; // -> dimmer grey, still >=4.5:1 on white
export const BUTTON_BG = "#0a0c0e"; // -> light pill (the app's primary Button)
export const BUTTON_FG = "#ffffff"; // -> dark label
export const LINK = "#0a66c2"; // saturated blue, readable inverted or not

// Status hues — the app's exact values, unchanged (saturated colors keep
// their meaning through inversion).
export const RED = "#f85149";
export const GREEN = "#3fb950";
export const AMBER = "#d29922";

const FONT = "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif";
const MONO = "ui-monospace,SFMono-Regular,Menlo,monospace";

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Table-based button so padding/background render consistently
// everywhere. Dark pill + light label as authored; a light pill with a
// dark label once Gmail inverts — i.e. the app's real primary Button.
export function emailButton(href: string, label: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
  <tr>
    <td bgcolor="${BUTTON_BG}" style="background-color:${BUTTON_BG};border-radius:16px;">
      <a href="${href}" style="display:inline-block;padding:13px 26px;color:${BUTTON_FG};font-size:14px;font-weight:600;text-decoration:none;font-family:${FONT};">${escapeHtml(label)}</a>
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
  /** Primary action, rendered at the foot of the card. */
  cta?: { href: string; label: string };
  /** Adds the "Gérer mes emails" footer link — notification emails only
   * (alerts, digest), not auth or invite mail. */
  manageEmails?: boolean;
}): string {
  return `<!doctype html>
<html lang="fr">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${escapeHtml(opts.title)}</title>
  </head>
  <body style="margin:0;padding:0;background-color:${PAGE_BG};">
    ${
      opts.preheader
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>`
        : ""
    }
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="${PAGE_BG}" style="background-color:${PAGE_BG};">
      <tr>
        <td align="center" style="padding:40px 16px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;border-collapse:collapse;">
            <tr>
              <td style="padding-bottom:28px;">
                <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
                  <tr>
                    <td style="width:32px;height:32px;">
                      <img
                        src="${LOGO_URL}"
                        width="32"
                        height="32"
                        alt="PostShip"
                        style="display:block;width:32px;height:32px;border-radius:8px;"
                      />
                    </td>
                    <td style="padding-left:11px;" valign="middle">
                      <span style="color:${TEXT};font-size:16px;font-weight:600;letter-spacing:-0.01em;font-family:${FONT};">PostShip</span>
                      ${
                        opts.eyebrow
                          ? `<br /><span style="color:${TEXT_MUTED};font-size:11px;font-family:${MONO};">${escapeHtml(opts.eyebrow)}</span>`
                          : ""
                      }
                    </td>
                  </tr>
                </table>
              </td>
            </tr>
            <tr>
              <td bgcolor="${CARD_BG}" style="background-color:${CARD_BG};border-radius:20px;padding:30px;">
                <h1 style="margin:0 0 10px;color:${TEXT};font-size:20px;font-weight:600;letter-spacing:-0.01em;font-family:${FONT};">${escapeHtml(opts.title)}</h1>
                ${
                  opts.intro
                    ? `<p style="margin:0 0 24px;color:${TEXT_MUTED};font-size:14px;line-height:1.6;font-family:${FONT};">${escapeHtml(opts.intro)}</p>`
                    : ""
                }
                ${opts.bodyHtml}
                ${
                  opts.cta
                    ? `<div style="margin-top:24px;">${emailButton(opts.cta.href, opts.cta.label)}</div>`
                    : ""
                }
              </td>
            </tr>
            <tr>
              <td style="padding-top:22px;">
                <p style="margin:0;text-align:center;color:${TEXT_FAINT};font-size:11px;line-height:1.8;font-family:${FONT};">
                  ${
                    opts.manageEmails
                      ? `<a href="${APP_URL}/app/account?tab=notifications" style="color:${TEXT_FAINT};text-decoration:underline;">G&eacute;rer mes emails</a><br />`
                      : ""
                  }
                  <a href="${APP_URL}/mentions-legales" style="color:${TEXT_FAINT};text-decoration:underline;">Mentions l&eacute;gales</a>
                  &middot;
                  <a href="${APP_URL}/privacy" style="color:${TEXT_FAINT};text-decoration:underline;">Confidentialit&eacute;</a>
                  &middot;
                  <a href="${APP_URL}/terms" style="color:${TEXT_FAINT};text-decoration:underline;">CGU</a>
                  &middot;
                  <a href="${APP_URL}/cgv" style="color:${TEXT_FAINT};text-decoration:underline;">CGV</a>
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
