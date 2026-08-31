# PostShip — Implementation plan

Do not start a slice until the previous one is green.

## Slice 1 — Foundation

Done when:

- Next.js 15 app boots with `pnpm dev`
- shadcn primitives installed
- `(marketing)/page.tsx` placeholder + `(app)/layout.tsx` shell
- `.env.example` matches keys
- `pnpm lint` + `pnpm typecheck` pass

Test: open `/` and see the name PostShip.

## Slice 2 — Auth

Done when:

- Magic link + GitHub work locally
- `/app` redirects if logged out
- `profiles` row created on first login (trigger or server upsert)

Test: login, land on `/app`, logout.

## Slice 3 — Projects + targets

Done when:

- Create / rename / delete project
- Add / disable target URLs
- Plan limits enforced (free = 1 project / 3 URLs)
- Invalid URL rejected client + server (https only)

Test: add `https://example.com` as http target.

## Slice 4 — Runner + SSRF

Done when:

- `runProjectChecks` executes all enabled targets
- Private IPs / localhost refused with `error` outcome, not a fetch
- Runs persist
- Cron path exists (`/api/cron/tick` + `CRON_SECRET`)
- Body capped, timeout works

Test: target `https://example.com` → pass. Target `https://127.0.0.1/` → error, no socket.

## Slice 5 — Dashboard

Done when:

- Project list shows last_status
- Timeline of last 50 runs
- Fail detail renders status, TTFB, missing OG, excerpt

Test: force a 404 target, see red + detail.

## Slice 6 — Alerts

Done when:

- Fail sends one email
- Second fail within 10 min with same fingerprint does not send
- Pass after fail sends recovered
- Discord fires on Solo/Team only

Test: use Resend test mode + a Discord webhook on a throwaway channel.

## Slice 7 — Billing

Done when:

- Checkout Solo / Team
- Webhook sets plan
- Downgrade to free when subscription canceled
- Portal link works
- Feature gating matches CLAUDE.md table

Test: Stripe test clock or dashboard cancel → plan free.

## Slice 8 — Marketing + demo

Done when:

- Landing explains the 3 checks with a real screenshot-less UI mock
- Pricing table
- Demo checks one URL, rate-limited
- `/privacy` `/terms` exist (TODO-LEGAL allowed)

Test: from logged-out browser, run demo on `https://example.com`.

## Suggested order of first local env

```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_SOLO=
STRIPE_PRICE_TEAM=
RESEND_API_KEY=
CRON_SECRET=
```
