# POSTSHIP — PROMPT UNIQUE À COLLER DANS CLAUDE CODE CLI
# Comment lancer :
#   mkdir postship && cd postship && git init && claude
#   Coller CE FICHIER EN ENTIER comme premier message.
#   Ne rien modifier avant d'avoir lu la Phase 0.

You are Claude Code acting as staff engineer for a new product called PostShip.

Do not vibe-code a generic SaaS dashboard. Follow this brief exactly.
Do not install packages or scaffold the Next.js app until Phase 0 files exist AND I reply `GO slice 1`.

════════════════════════════════════════
PRODUCT
════════════════════════════════════════

PostShip is a digital micro-SaaS: post-deploy / synthetic monitoring for indie founders and tiny product teams.

It does NOT ping only the homepage.
After every Vercel deploy (or on a cron), it acts like a user and verifies critical URLs still work: HTTP status, redirect loops, title/description, Open Graph + Twitter cards, sitemap.xml, JSON-LD syntax, SSL expiry, optional Stripe success-page health.

If something fails: grouped Discord + email alert.
If it recovers: a recovered message.
Silence when green.

One-liner: “After each deploy, PostShip plays the customer. Alert in two minutes if checkout, OG, or sitemap is broken.”

ICP
- Solo indie hacker or 1–5 person product team
- Typical stack: Next.js + Vercel + Stripe + Supabase
- 1–10 production sites
- Pays already for Vercel / Resend; 12–29 €/mo is acceptable if it prevents a silent outage

Pricing (EUR, monthly, Stripe)
- Free: 1 project, 3 URLs, every 30 min, email only
- Solo 12 €: 3 projects, 15 URLs, every 5 min, Discord + email, OG/sitemap, Vercel deploy hook
- Team 29 €: 10 projects, 50 URLs, Stripe health check, 30-day run retention

NOT in scope (never build)
- Ahrefs / Semrush clone
- Datadog / Sentry APM / session replay
- ChatGPT wrapper
- Invoicing, bookkeeping, artisan/BTP tools
- Public status page (v1.1)
- Lighthouse on 50 URLs per commit
- Native mobile app
- Full Slack product (Discord webhook is enough)
- Competitive SEO audits

════════════════════════════════════════
STACK — DO NOT DEVIATE WITHOUT ASKING
════════════════════════════════════════

- Next.js 15 App Router, TypeScript strict, `src/` directory
- Tailwind CSS + shadcn/ui
- Supabase: Auth (magic link + GitHub OAuth), Postgres, RLS, EU region
- Stripe Checkout + Customer Portal + webhooks
- Resend for transactional email
- ONE job runner: prefer Inngest. If you pick Vercel Cron + `check_jobs` table instead, document why in ARCHITECTURE.md and commit to it.
- Zod at every boundary (forms, query params, webhooks, job payloads)
- pnpm
- Deploy target: Vercel
- Tests later (Vitest). Not on day 1.

Language rules
- UI: French default, i18n-ready (message keys, no hardcoded French sprinkled in 40 files)
- Source code, file names, commits: English
- Alerts: project locale `fr` | `en`

Visual
- Dark, calm, operational. Mono for URLs. Green / amber / red status.
- No generic AI-purple gradient dashboard.
- Mobile-usable.

════════════════════════════════════════
SECURITY — NON-NEGOTIABLE
════════════════════════════════════════

SSRF
Every outbound fetch MUST:
- accept https only
- reject localhost, loopback, link-local, RFC1918, metadata IPs (169.254.169.254), internal hostnames
- cap redirects at 5
- timeout 12s per URL
- concurrency max 3 per project
User-Agent: `PostShipBot/0.1 (+https://postship.app)`

Secrets
- Never commit `.env`
- `.env.example` only
- Webhook signatures verified (Stripe, Vercel if present)
- RLS on from the first table
- The public “try one URL” demo is rate-limited by IP and uses the same SSRF guard

════════════════════════════════════════
PHASE 0 — WRITE SPECS ONLY
════════════════════════════════════════

Create these files, then STOP:

1. CLAUDE.md
2. docs/PRD.md
3. docs/ARCHITECTURE.md
4. docs/DATA_MODEL.md   (include exact SQL: types, indexes, RLS)
5. docs/PLAN.md
6. .env.example         (keys listed, no values)
7. README.md            (how a human runs the project later)

Then list at most 5 blocking questions.
Do not run `pnpm create`, do not add shadcn, do not write React pages.

════════════════════════════════════════
SLICES AFTER I SAY GO
════════════════════════════════════════

Slice 1 — Foundation
pnpm create next-app (App Router, TS, Tailwind, src/, eslint)
shadcn init + button, card, input, badge, tabs, dialog, dropdown-menu, sonner
Route groups: src/app/(marketing), src/app/(app)
Update CLAUDE.md with real commands.

Slice 2 — Auth
Supabase clients (server, browser, middleware)
Magic link + GitHub
`profiles` table
Protect `/app/*`

Slice 3 — Projects + targets
CRUD projects and check targets
Statuses derived from latest runs
Empty state: “Ajoute l’URL de prod”

Slice 4 — Runner
`runProjectChecks(projectId)`
Persist every result (pass and fail) in `check_runs`
Cron: */5 paid, */30 free
Vercel deploy hook endpoint (signature if documented)

Slice 5 — Dashboard
Project list with traffic-light
Run timeline
Fail detail: status, TTFB, missing OG, body excerpt (truncated)

Slice 6 — Alerts
Resend + Discord webhook
Group failures per project per 10-minute window
Dedup identical consecutive fails
Send recovered event when a target goes fail → pass

Slice 7 — Billing
Stripe Solo / Team
Feature gating
Customer Portal
Handle `checkout.session.completed` and `customer.subscription.updated`

Slice 8 — Marketing
One-screen landing: problem, 3 example checks, pricing, CTA
Public demo: check one URL (rate limit + SSRF guard)
Legal stubs: /privacy /terms (FR, mark TODO-LEGAL if unsure — do not invent law)

MVP checks, in this order
1. HTTP status, TTFB, body size, redirect loop
2. expect_contains / expect_not_contains
3. title, meta description, canonical, robots
4. og:title, og:image (HEAD the image, must be 200)
5. twitter card basics
6. sitemap.xml parse + sample up to 10 URLs
7. JSON-LD parse (no syntax error)
8. SSL expiry < 14 days
9. Optional stripe_health: GET success URL + HEAD webhook route (do NOT replay Stripe events)

════════════════════════════════════════
ENGINEERING RULES
════════════════════════════════════════

- One slice at a time. End of slice = summary, how to test (≤5 lines), files touched.
- Server Components by default. `"use client"` only when interactive.
- Named exports except page.tsx / layout.tsx.
- No `any`. No unused ignore comments.
- Do not `git add -A`. Stage by name.
- Commits: feat|fix|chore|docs|refactor(scope): message
- Smallest reasonable diff. Match existing style once it exists.
- If a Stripe / Supabase / Vercel API is uncertain: read official docs. Do not invent endpoints.
- After each slice: `pnpm typecheck` and `pnpm lint` (or the exact scripts in package.json).

First action: write Phase 0 files only. Then wait for `GO slice 1`.
