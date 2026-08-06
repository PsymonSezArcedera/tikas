@AGENTS.md
# CLAUDE.md — Tikas

Project instructions for Claude Code. Read this every session. The full product spec lives in `SPEC.md` (or `/docs/SPEC.md`) — read it before implementing any feature.

## What Tikas is

Tikas ("your fitness companion") is an AI-powered fitness web app: workout planning, calorie counting, weight/body tracking, analytics, and three AI coaching personas. Name is Tagalog for an upright, athletic bearing. It's a solo portfolio project — code clarity and a good commit history matter as much as the feature working.

## Stack (do not substitute without asking)

- **Next.js 16**, App Router, TypeScript, Turbopack
- **Tailwind CSS + shadcn/ui** — component base is **Base UI** (NOT Radix), preset **Nova**. If generated component code imports from `radix-ui`, that's wrong — it must match the Base UI base.
- **Prisma ORM** with the **`@prisma/adapter-neon`** driver adapter
- **Neon PostgreSQL** (Singapore region, `ap-southeast-1`)
- **Better Auth** for authentication (email/password + Google) — NOT NextAuth/Auth.js
- **Zod** for all validation
- **Gemini 2.5 Flash** for AI (structured output + streaming)
- **TanStack Query** for client data fetching, **Recharts** for charts
- Deployed on **Vercel** (`tikas-navy.vercel.app`)

## Non-negotiable rules

1. **Deploy every feature.** After each working feature: commit, push, confirm the Vercel deploy is green. Never batch up a "deployment phase" at the end.
2. **Validate everything with Zod at the boundary.** Every Server Action input, every form, and — critically — every Gemini JSON response gets parsed with a Zod schema before it touches the database. Never write unvalidated AI output to Prisma.
3. **Database:** Runtime queries use the pooled `DATABASE_URL` via the `@prisma/adapter-neon` driver adapter in `lib/db.ts`; migrations/CLI use the direct `DIRECT_URL`. Both are in `.env` and in Vercel. **Prisma 7 config note:** the datasource URL lives in `prisma.config.ts` (`datasource.url` → `DIRECT_URL`), *not* in the `schema.prisma` datasource block — there is no `url`/`directUrl` field on the block anymore. Migrations connect through `datasource.url`, runtime through the adapter. Never hardcode connection strings. Never commit `.env`. On a dev machine with broken IPv6, run migrations via `npm run db:migrate` (forces IPv4 — see `scripts/db-migrate.mjs`) instead of `prisma migrate` directly.
4. **Secrets** go in `.env` locally and Vercel env vars for prod — never in committed code. This applies to the coming `GEMINI_API_KEY`, Better Auth secret, and Google OAuth credentials too.
5. **Store measurements in metric** (kg, cm); convert at display time from the user's `unitPreference`.

## Architecture conventions

- `lib/validations/` — Zod schemas, shared by forms, Server Actions, and AI-output parsing
- `lib/ai/` — Gemini client, the three coach system prompts, and the server-side medical-topic pre-check
- `lib/db.ts` — single Prisma client instance (avoid multiple clients in dev)
- Prefer **Server Actions** for mutations; Route Handlers for streaming AI chat
- Keep the schema in sync with `SPEC.md` — it's the source of truth for models

## The AI coaches

Three personas (Fortis/strength, Vita/nutrition, Lux/wellness) — one Gemini model, three system prompts.

- **Soft handoffs, not hard rejections.** If a user asks Fortis a nutrition question, Fortis answers briefly and offers to hand off to Vita. Coaches never refuse mid-conversation over topic boundaries.
- **Prompt restrictions are advisory, not security.** Don't rely on them for anything that matters.
- **Medical topics get a real server-side guardrail** — a keyword/classifier pre-check before the message reaches Gemini, plus a system-prompt instruction to decline diagnosis and refer to professionals, plus a standing UI disclaimer. This is the one restriction that's enforced, not just prompted.
- Generate workout plans with Gemini **structured output**, validate with Zod against the `Exercise` schema, then store. **Stream** all coach chat responses.

## UI direction

Dark-first athletic dashboard. Bento-grid layout of rounded cards on a near-black base. Oversized numerals as heroes (current weight, streak, calories — big, with trend arrows). One ember accent color plus semantic green/red for trends. Coach personas can tint their own chat headers/avatars subtly, but never introduce three competing accent colors on the dashboard. Light mode is a toggle, dark is default. Use `backdrop-blur` sparingly (sticky header only) — heavy glassmorphism kills performance on mid-range Android, which is a big part of the audience.

## Build order (from SPEC.md roadmap)

1. Foundation — Prisma+Neon, Better Auth, Zod scaffolding *(current phase)*
2. Core tracking — dashboard, weight/body logging, calorie logging (manual-first + Open Food Facts)
3. Workout planner
4. AI coaching (streaming, three coaches, medical guardrail)
5. Analytics + streaks (`DailyActivity` table)
6. Polish + hardening

Work one small, reviewable task at a time. Prefer a clean diff I can read over a large blob I can't.

## Environment note

Dev machine is Windows, 8GB RAM. Keep the dev footprint light; don't spin up local Postgres/Docker (Neon is cloud-hosted for exactly this reason).