// Feedback fix: every transactional email built its own bare HTML
// fragment (a plain "PostShip — {project}" line, no real logo, no legal
// footer) — this shell gives every Resend-sent email (alerts, digest,
// invites) the same branded header/footer so an inbox full of them still
// reads as one product. Dark, operational, no purple-AI gradient
// (CLAUDE.md) — the actual app icon as the logo, not a lettered badge.
//
// Legal footer: only the identity fields confirmed in src/lib/legal.ts
// are used (editorName, address) — the rest of LEGAL is still
// "FIXME_LEGAL" (SIRET, phone, VAT) and must never be guessed into an
// email either.
import { LEGAL } from "@/lib/legal";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://postship.fr";
const LOGO_URL = `${APP_URL}/apple-icon.png`;

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
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
    <title>${escapeHtml(opts.title)}</title>
  </head>
  <body style="margin:0;background:#050708;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    ${
      opts.preheader
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>`
        : ""
    }
    <div style="padding:40px 16px;">
      <table role="presentation" style="max-width:520px;margin:0 auto;width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding-bottom:24px;">
            <table role="presentation" style="border-collapse:collapse;">
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
                <td style="padding-left:10px;">
                  <span style="color:#e6edf3;font-size:16px;font-weight:600;letter-spacing:-0.01em;">PostShip</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#0d1117;border:1px solid #21262d;border-radius:16px;padding:28px;">
            <h1 style="margin:0 0 8px;color:#e6edf3;font-size:17px;font-weight:600;">${escapeHtml(opts.title)}</h1>
            ${
              opts.intro
                ? `<p style="margin:0 0 20px;color:#8b949e;font-size:13px;line-height:1.6;">${escapeHtml(opts.intro)}</p>`
                : ""
            }
            ${opts.bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding-top:20px;text-align:center;">
            <a href="${APP_URL}/app" style="color:#8b949e;font-size:12px;text-decoration:none;">Ouvrir PostShip</a>
            <span style="color:#30363d;"> &middot; </span>
            <a href="${APP_URL}/app/account?tab=notifications" style="color:#8b949e;font-size:12px;text-decoration:none;">${escapeHtml(opts.footerReason ?? "Gérer les notifications")}</a>
          </td>
        </tr>
        <tr>
          <td style="padding-top:16px;">
            <p style="margin:0;text-align:center;color:#484f58;font-size:11px;line-height:1.6;">
              Surveillance post-déploiement pour sites et SaaS indie.<br />
              PostShip &mdash; ${escapeHtml(LEGAL.editorName)} &mdash; ${escapeHtml(LEGAL.address)}<br />
              <a href="${APP_URL}/terms" style="color:#484f58;text-decoration:underline;">CGU</a>
              &middot;
              <a href="${APP_URL}/privacy" style="color:#484f58;text-decoration:underline;">Confidentialité</a>
              &middot;
              <a href="${APP_URL}/cgv" style="color:#484f58;text-decoration:underline;">CGV</a>
            </p>
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>`;
}
