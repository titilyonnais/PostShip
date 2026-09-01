# PostShip — Architecture

## Request paths

```
Browser  →  Next.js (Vercel)
              ├─ (marketing) public pages + demo check API
              ├─ (app) server components, cookie session
              └─ /api
                   ├─ /api/stripe/webhook
                   ├─ /api/vercel/deploy
                   └─ /api/cron/tick   (external cron service, see Runner)

Runner   →  https targets on the public internet
         →  MUST pass src/lib/ssrf.ts first
         →  writes check_runs
         →  maybe enqueue alert
```

## Auth

- Supabase Auth.
- Server client in Server Components / Route Handlers.
- Middleware refreshes session and blocks `/app/*` when anonymous.
- `profiles.id` = `auth.users.id`.

## Runner

Decision: an external cron service + `check_jobs`, not Inngest, not Vercel's native cron. Reason: no extra account/service to run for the check logic itself, and job volume stays small at indie scale (max 50 URLs, every 5 min on Team) — a second job service isn't worth the added moving part for the MVP. Vercel's native cron was ruled out separately (see trigger caveat below).

`/api/cron/tick` (auth'd with `CRON_SECRET`) selects due projects (interval by plan: 30 min free, 5 min paid), inserts `check_jobs`, and processes the batch with bounded concurrency across projects (`INTER_PROJECT_CONCURRENCY` in the route) — each project's own targets already run with their own concurrency limit (`MAX_CONCURRENCY_PER_PROJECT` in `src/lib/runner.ts`). A row-based lock (`cron_lock` table, atomic conditional `UPDATE`) makes the whole tick single-flight, so an overlapping invocation skips instead of double-processing the same due projects.

Trigger caveat: Vercel Hobby plan caps Cron Jobs at once/day, which can't drive a 5-minute interval. `.github/workflows/cron.yml`'s `*/5 * * * *` schedule was tried first but proved unreliable in production — GitHub does not guarantee scheduled-workflow timing on a low-activity repo, and observed gaps between runs were 3-5 hours, not minutes (this is why site scans and paid-plan checks were stalling). The primary 5-minute trigger is now an external cron service (cron-job.org, configured and verified hitting `/api/cron/tick` on schedule) calling with `CRON_SECRET`; the GitHub Actions workflow stays as an hourly backup only. Swap to `vercel.json` native crons (or a managed queue like Inngest/QStash) once the project is on Vercel Pro or the job volume outgrows this.

Per target:

1. Validate URL (ssrf.ts)
2. Fetch with 12s timeout, 5 redirects max, 512 KiB body cap
3. Run applicable parsers (status, HTML meta, OG image HEAD, sitemap, JSON-LD, TLS notAfter)
4. Insert `check_runs`
5. Compare with previous run of same target → maybe alert or recover

Never use the runner as an open proxy. Demo endpoint shares the same guard + IP rate limit (e.g. 5/hour).

## Alerts

- Dedupe key: `project_id + target_id + fingerprint` (status + missing fields)
- If last alert for that key < 10 minutes and still failing → skip
- Group all new fails for a project into one email / one Discord embed
- Recover: previous run fail, current pass → recovered event, clear fingerprint

## Billing

- Stripe Checkout for Solo / Team
- `customers.stripe_customer_id` and `subscriptions` status on `profiles` or `workspaces`
- Webhook verified with raw body
- Entitlements read from `profiles.plan` updated only by webhook (not from the client)

## Domain

Production hostname is `postship.fr` (not `postship.app` — already taken by another product). Applies everywhere: `NEXT_PUBLIC_APP_URL`, the SSRF User-Agent, canonical links, cookies, Stripe webhook return URLs, Resend `from` address (`noreply@postship.fr` once the domain is verified).

Until DNS points at Vercel, deploys are reachable at `*.vercel.app` previews, but the hostname baked into code/config stays `postship.fr`.

## Isolation

- One user owns projects (v1, no team members yet — Team plan is limit bump only)
- RLS: `projects.user_id = auth.uid()`
- Child tables via join on project ownership

## Observability (ours)

- Structured logs on runner errors
- Do not log response bodies in full (truncate excerpt 500 chars)
- Do not log secrets

## Key modules

| Module | Responsibility |
|---|---|
| `src/lib/ssrf.ts` | Parse + deny private/metadata |
| `src/lib/checks/http.ts` | Fetch + timing + title/canonical/JSON-LD parsing |
| `src/lib/checks/og.ts` | OG/Twitter + image HEAD |
| `src/lib/checks/sitemap.ts` | XML parse + sample |
| `src/lib/checks/ssl.ts` | TLS certificate notAfter |
| `src/lib/checks/stripe-health.ts` | Success-page GET (webhook route not checked — no schema column for a second URL yet) |
| `src/lib/alerts.ts` | group / dedup / Resend / Discord |
| `src/lib/entitlements.ts` | plan limits |
