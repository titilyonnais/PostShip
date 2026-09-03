import { permanentRedirect } from "next/navigation";

// Feedback fix: account settings moved from real routes per tab into a
// single ?tab= hub (account/page.tsx) — this route stays valid,
// permanently redirecting so no old link (Stripe checkout success/cancel
// URLs, the "en acheter" links from project pages) breaks. Forwards
// along whatever other query params it was hit with (?from=, ?error=,
// ?checkout=).
export default async function TokensRedirectPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const query = new URLSearchParams();
  query.set("tab", "tokens");
  for (const [key, value] of Object.entries(params)) {
    if (typeof value === "string") query.set(key, value);
  }
  permanentRedirect(`/app/account?${query.toString()}`);
}
