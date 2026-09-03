import { permanentRedirect } from "next/navigation";

// Feedback fix: account settings moved from real routes per tab into a
// single ?tab= hub (account/page.tsx) — this route stays valid,
// permanently redirecting so no old link breaks. Named "billing" here
// (the DB/route segment) but shown as "Factures" in the UI — the billing
// *address*, not /app/billing's subscription management.
export default function BillingAddressRedirectPage() {
  permanentRedirect("/app/account?tab=billing");
}
