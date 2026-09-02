# PostShip — Claude Code context

Post-deploy / synthetic monitoring for indie SaaS. After each deploy (or on cron), fetch the customer's critical URLs like a user would: HTTP, OG/Twitter, sitemap, JSON-LD, SSL, optional Stripe success page. Alert Discord/Slack + email on fail and recover. Stay silent when green.

## Stack

- Next.js 15 App Router, TypeScript strict, `src/`
- Tailwind + shadcn/ui
- Supabase Auth (magic link + GitHub), Postgres, RLS, EU
- Stripe Billing (Checkout + Customer Portal + webhooks)
- Resend
- Vercel Cron + `check_jobs` table for the check runner (decision recorded in `docs/ARCHITECTURE.md`, not Inngest)
- Zod at every boundary
- pnpm, Vercel

## Commands

```
pnpm dev
pnpm lint
pnpm typecheck
pnpm build
```

## Layout

- `src/app/(marketing)/` landing, pricing, legal, public demo
- `src/app/(app)/` authenticated dashboard
- `src/app/api/` webhooks (stripe, vercel, cron)
- `src/lib/checks/` one file per check type
- `src/lib/ssrf.ts` URL allow/deny — used by every outbound fetch
- `src/lib/db/` Supabase server helpers
- `supabase/migrations/` SQL migrations (mirrors `docs/DATA_MODEL.md`)
- `docs/` product specs

## Rules — never violate

- https-only outbound fetches. Block loopback, RFC1918, link-local, cloud metadata, internal hosts.
- Max 5 redirects, 12s timeout, concurrency 3 per project.
- User-Agent: `PostShipBot/0.1 (+https://postship.fr)`
- RLS on every user table from day one.
- Never commit `.env` or secrets. Stage files by name, not `git add -A`.
- Server Components default. `"use client"` only for interactivity.
- Named exports except `page.tsx` / `layout.tsx`.
- No `any`. Parse with Zod.
- Do not invent Stripe / Supabase / Vercel APIs.
- Do not build public status pages, Lighthouse CI, APM, or invoicing. Exception, decided 2026-09-02: a per-project opt-in single-badge SVG endpoint (`/badge/[projectId]`, pass/fail only, no history, no URL list, no incident log, 404 unless the owner enables it) is allowed — it is not a status page (no dashboard, no uptime %, no multi-service view). Anything beyond that single badge still needs this rule revisited first.
- UI French default via i18n keys; code and commits in English.
- Dark operational UI. Mono URLs. Green / amber / red. No purple AI aesthetic.

## Product limits by plan

| | Free | Solo 12€ | Team 29€ |
|---|---|---|---|
| Projects | 1 | 3 | 10 |
| URLs | 3 | 15 | 50 |
| Interval | 30 min | 5 min | 5 min |
| Chat webhooks (Discord/Slack) | no | yes | yes |
| Deploy hooks (Vercel/Netlify/Cloudflare Pages) | no | yes | yes |
| Stripe health | no | no | yes |
| Collaborators (per-project, see `project_members`) | no | no | yes |
| Retention | 7 days | 14 days | 30 days |

## Git

`feat|fix|chore|docs|refactor(scope): message`
