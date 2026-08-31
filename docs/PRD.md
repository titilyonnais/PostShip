# PostShip — PRD

## Problem

Homepage uptime pings miss production failures that lose money or distribution:

- `/checkout` or `/login` returns 500 after a deploy
- `og:image` 404 → ugly unfurls on X, iMessage, Slack
- `sitemap.xml` invalid
- SSL expires in 10 days
- Stripe success route broken

Founders learn this from a customer or a social share. Too late.

## Who

Indie hacker or 1–5 person product team. Next.js + Vercel + Stripe. 1–10 production sites.

## Job to be done

“After I ship, tell me within two minutes if a user-facing URL is broken, including metadata and checkout — not just whether the origin responds.”

## What it does (MVP)

1. User signs in (magic link or GitHub).
2. Creates a project with a production base URL.
3. Adds check targets (absolute https URLs) with optional expect_contains / expect_not_contains.
4. Runner executes checks on cron and, on paid plans, on Vercel deploy hook.
5. Each run is stored (pass and fail).
6. Failures send one grouped email (and Discord on paid) per project per 10-minute window.
7. Recovery sends a recovered event.
8. Dashboard: traffic light, timeline, fail detail.
9. Stripe subscription gates plan limits.
10. Marketing site + IP-rate-limited public demo of a single URL check.

## What it does not do

APM, session replay, log drain, SEO competitor research, content writing, invoicing, public status page (v1.1), Lighthouse farms, mobile app.

## Checks (priority order)

1. HTTP status, TTFB, body size, redirect loop
2. expect_contains / expect_not_contains
3. title, description, canonical, robots
4. og:title + og:image (HEAD image → 200)
5. Twitter card basics
6. sitemap.xml parse + sample ≤ 10 URLs
7. JSON-LD syntax
8. SSL not-after < 14 days
9. Team only: GET Stripe success URL + HEAD webhook route (never replay events)

## Pricing

- Free: 1 project / 3 URLs / 30 min / email
- Solo 12 € TTC: 3 / 15 / 5 min / Discord + Vercel hook
- Team 29 €: 10 / 50 / Stripe health / 30-day retention

## Success metrics (once live)

- Time-to-first-alert after a known broken deploy < 3 min on Solo
- False positive rate low enough that users do not mute Discord
- Activation: 1 project + 1 URL + 1 successful run in session 1
- Paid conversion: user who added a checkout or OG check

## Risks

- SSRF if URL validation is sloppy
- Alert fatigue if grouping/dedup fails
- Cost if someone adds slow or huge pages (timeouts + body cap required)
- Better Stack / Checkly / Oh Dear / UptimeRobot as alternatives — win on Next/Vercel + OG/sitemap specificity and price, not on raw probe network
