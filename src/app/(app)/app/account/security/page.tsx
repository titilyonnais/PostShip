import { permanentRedirect } from "next/navigation";

// Feedback fix: account settings moved from real routes per tab into a
// single ?tab= hub (account/page.tsx) — this route stays valid,
// permanently redirecting so no old link (bookmarks, the MFA/email-change
// email redirect) breaks.
export default function SecurityRedirectPage() {
  permanentRedirect("/app/account?tab=security");
}
