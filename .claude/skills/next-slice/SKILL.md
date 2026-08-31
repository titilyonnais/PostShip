---
name: next-slice
description: Implement the next unfinished slice of PostShip from docs/PLAN.md, following the engineering rules in PROMPT-DEPART-CLAUDE-CODE.md and CLAUDE.md. Use when the user says "GO slice N", "next slice", or asks to continue the build.
disable-model-invocation: true
---

Build PostShip one slice at a time, per `docs/PLAN.md`.

## Steps

1. Read `docs/PLAN.md` to find the slices and their "Done when" criteria. Read `docs/ARCHITECTURE.md`, `docs/DATA_MODEL.md`, and `CLAUDE.md` for the constraints that apply.
2. Determine the target slice:
   - If `$ARGUMENTS` names a slice number, use it.
   - Otherwise, inspect the repo state against each slice's "Done when" list and pick the first slice that is not fully satisfied.
3. If this is Slice 1 and the project has not been scaffolded yet (no `package.json`), confirm with the user before running `pnpm create next-app` / `shadcn init` — these are the first commands that leave the "specs only" phase.
4. Implement only that slice. Do not start the next one.
5. Follow the non-negotiable rules from `PROMPT-DEPART-CLAUDE-CODE.md`:
   - Server Components by default; `"use client"` only when interactive.
   - Named exports except `page.tsx` / `layout.tsx`.
   - No `any`; validate with Zod at every boundary.
   - Every outbound fetch goes through `src/lib/ssrf.ts` (https only, block loopback/RFC1918/link-local/metadata IPs, 5 redirect cap, 12s timeout, concurrency 3/project, `PostShipBot/0.1` User-Agent).
   - RLS on every new table from the start.
   - Stage files by name — never `git add -A`.
   - Smallest reasonable diff; match existing style once it exists.
   - If a Stripe / Supabase / Vercel API is uncertain, look it up — do not invent endpoints.
6. Once the slice's "Done when" criteria are met, run `pnpm typecheck` and `pnpm lint` (or the exact scripts in `package.json`) and fix failures.
7. End with a summary of at most 5 lines: what changed, how to test it manually, and files touched. Do not summarize beyond that.
