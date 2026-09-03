// Feedback fix: every transactional email built its own bare HTML
// fragment (a plain "PostShip — {project}" line, no logo, no consistent
// footer) — this shell gives every Resend-sent email (alerts, digest,
// invites) the same branded header/footer so an inbox full of them still
// reads as one product. Dark, operational, no purple-AI gradient
// (CLAUDE.md) — a small green wordmark badge, not a photo/illustration.
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? "https://postship.fr";

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
  bodyHtml: string;
}): string {
  return `<!doctype html>
<html lang="fr">
  <body style="margin:0;background:#050708;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
    ${
      opts.preheader
        ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(opts.preheader)}</div>`
        : ""
    }
    <div style="padding:40px 16px;">
      <table role="presentation" style="max-width:480px;margin:0 auto;width:100%;border-collapse:collapse;">
        <tr>
          <td style="padding-bottom:24px;">
            <table role="presentation" style="border-collapse:collapse;">
              <tr>
                <td style="width:28px;height:28px;border-radius:8px;background:#3fb950;text-align:center;vertical-align:middle;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">
                  <span style="color:#0a0c0e;font-size:14px;font-weight:700;line-height:28px;">P</span>
                </td>
                <td style="padding-left:10px;">
                  <span style="color:#e6edf3;font-size:15px;font-weight:600;letter-spacing:-0.01em;">PostShip</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <tr>
          <td style="background:#0d1117;border:1px solid #21262d;border-radius:16px;padding:24px;">
            <h1 style="margin:0 0 16px;color:#e6edf3;font-size:15px;font-weight:600;">${escapeHtml(opts.title)}</h1>
            ${opts.bodyHtml}
          </td>
        </tr>
        <tr>
          <td style="padding-top:20px;text-align:center;">
            <a href="${APP_URL}/app" style="color:#8b949e;font-size:12px;text-decoration:none;">Ouvrir PostShip</a>
            <span style="color:#30363d;"> &middot; </span>
            <a href="${APP_URL}/app/account?tab=notifications" style="color:#8b949e;font-size:12px;text-decoration:none;">Gérer les notifications</a>
          </td>
        </tr>
        <tr>
          <td style="padding-top:8px;text-align:center;">
            <span style="color:#484f58;font-size:11px;">Surveillance post-déploiement pour sites et SaaS indie.</span>
          </td>
        </tr>
      </table>
    </div>
  </body>
</html>`;
}
