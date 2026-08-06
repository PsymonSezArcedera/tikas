# Tikas: Your Fitness Companion

## Project Specification

### Overview

Tikas is an AI-powered fitness web application designed to help users build strength, improve nutrition, and maintain overall wellness through personalized AI coaching and data-driven fitness tracking.

The name comes from the Tagalog *matikas* — an upright, well-built, athletic bearing — the visible result of consistent training.

---

# Technology Stack

## Frontend
- Next.js 15 (App Router)
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- **TanStack Query** — client-side data fetching with optimistic updates (food/weight logging should feel instant)
- **Recharts** — analytics charts (pairs with shadcn/ui chart components, which are built on it)

## Backend
- Next.js Route Handlers
- Server Actions
- **Zod** — validation layer for all form inputs, Server Action payloads, and AI JSON outputs before they touch the database

## AI
- Gemini 2.5 Flash API
  - **Structured output (JSON mode)** for workout plan generation — plans must map cleanly to the `Exercise` schema
  - **Streaming responses** for all coach chat

## Database
- PostgreSQL (Neon)
- Prisma ORM with **`@prisma/adapter-neon`** (Neon serverless driver adapter)
- **Pooled connection string required** — serverless functions exhaust direct connections
- ⚠️ Free-tier Neon suspends after ~5 min idle; expect 1–3s cold start on first request per session
- *Alternative considered:* Drizzle ORM (lighter bundles, faster cold starts) — revisit if Prisma cold-start overhead becomes a problem

## Authentication
- **Better Auth** — first-class email/password support + Google OAuth, clean API
- *Alternative considered:* Auth.js (NextAuth v5) — rejected due to second-class credentials-provider support and rough v5 migration docs

## External APIs
- **Open Food Facts API** (primary) / USDA FoodData Central — food search database
- ⚠️ Filipino foods are poorly covered in both; **manual entry is the primary logging path**, search is a bonus

## Deployment
- Vercel — **deployed from day one**, not as a final phase

---

# Core Features

## 1. Authentication
- Email & Password
- Google Login
- Secure user sessions
- Profile management (including **unit preference: metric/imperial**)

## 2. Dashboard
Displays:
- Current weight
- Goal weight
- BMI
- Calories consumed
- Macronutrients
- Workout statistics
- Progress charts

## 3. AI Coaching System

Three coach personas backed by one model (Gemini 2.5 Flash) with distinct system prompts. Personas specialize but **hand off softly** rather than hard-rejecting adjacent topics.

### Fortis — Strength Coach
Specializes in:
- Workout routines
- Exercise form
- Progressive overload
- Strength training
- Cardio recommendations

### Vita — Nutrition Coach
Specializes in:
- Calorie management
- Macronutrients
- Meal planning
- Weight loss/gain nutrition
- Healthy eating habits

### Lux — Wellness Coach
Specializes in:
- Sleep optimization
- Recovery strategies
- Stress management
- Habit building
- Motivation and consistency

---

# AI Guardrails

## Design principles

1. **Soft handoffs, not hard rejections.** If a user asks Fortis a nutrition question, Fortis gives a brief answer and offers to open a session with Vita — it never refuses mid-conversation. Topic boundaries shape each persona's depth, not its willingness to help.
2. **Prompt-level boundaries are advisory, not security.** System-prompt restrictions are trivially bypassed and are never marketed as "strict."
3. **Medical topics get a real server-side guardrail.** This is the one restriction that matters legally and ethically, so it is enforced outside the prompt:
   - Lightweight server-side pre-check (keyword/classifier) on user messages before they reach Gemini
   - System-prompt instruction to decline diagnosis and direct users to professionals
   - Standing disclaimer in the chat UI

## Per-coach depth

| Coach | Deep expertise | Soft handoff to | Always declines |
|---|---|---|---|
| Fortis | Exercises, sets/reps, programs, training advice | Vita (nutrition), Lux (recovery) | Medical diagnosis |
| Vita | Calories, macros, foods, meal plans | Fortis (training), Lux (habits) | Medical diagnosis |
| Lux | Sleep, recovery, stress, habits | Fortis (programming), Vita (detailed nutrition) | Medical diagnosis |

---

# Workout Planner

Users can generate personalized workout plans based on:

- Goal
- Available time
- Training days
- Equipment
- Intensity
- Target muscle groups

Plans are generated via **Gemini structured output**, validated with **Zod** against the `Exercise` schema, then stored. Generated plans are editable.

---

# Calorie Counter

Features:
- **Manual food logging (primary path)** with numeric quantity + serving size
- Food search via Open Food Facts / USDA FoodData Central
- Daily calorie tracking
- Protein, carbs, and fat tracking
- Meal categorization (Breakfast, Lunch, Dinner, Snacks)
- Optimistic UI updates on log entry

---

# Weight & Body Tracking

Users can log:
- Weight
- Body fat %
- Body measurements: waist, chest, arms

Progress is visualized through charts. All values stored in metric; displayed per user unit preference.

---

# Analytics

Charts (Recharts) include:
- Weight trend
- Calorie trend
- Workout frequency
- BMI progression
- Macro distribution
- Streaks (from `DailyActivity`, not derived at query time)

---

# Database Schema

> Conventions: all measurements stored in **metric** (kg, cm); converted at display time from `User.unitPreference`. All editable entities carry `updatedAt`.

## Users
- id
- name
- email
- passwordHash
- height          (cm)
- weight          (kg)
- goalWeight      (kg)
- birthday
- gender
- activityLevel
- **unitPreference** (METRIC | IMPERIAL)
- createdAt
- **updatedAt**

## WorkoutPlans
- id
- userId
- title
- goal
- intensity
- days
- duration
- createdAt
- **updatedAt**

## Exercises
- id
- planId
- day
- exercise
- sets
- reps
- rest
- notes
- **updatedAt**

## FoodLogs
- id
- userId
- mealType
- foodName
- **quantity**       (numeric — amount consumed)
- **servingSize**     (numeric — grams/ml per serving)
- **servingUnit**     (g | ml | piece | cup | ...)
- calories
- protein
- carbs
- fat
- date

## WeightLogs
- id
- userId
- weight         (kg)
- bodyFat
- date

## BodyMeasurements
- id
- userId
- waist          (cm)
- chest          (cm)
- leftArm        (cm)
- rightArm       (cm)
- date

## DailyActivity
- id
- userId
- date            (unique per user per day)
- loggedFood      (boolean)
- loggedWeight    (boolean)
- workedOut       (boolean)

*(Streaks are computed from this table — never derived by scanning logs at query time.)*

## ChatSessions
- id
- userId
- coachType
- title
- createdAt

## ChatMessages
- id
- sessionId
- role
- message
- timestamp

---

# Recommended Folder Structure

```text
app/
  (auth)/
  dashboard/
  workout/
  nutrition/
  wellness/
  api/
components/
lib/
  validations/   ← Zod schemas (shared by forms, Server Actions, AI output parsing)
  ai/            ← Gemini client, coach system prompts, medical-topic pre-check
hooks/
types/
prisma/
public/
```

---

# Development Roadmap

## Phase 1 — Foundation & Continuous Deployment
- Next.js setup
- Tailwind & shadcn/ui
- Prisma + Neon (pooled connection, serverless adapter)
- Better Auth (email/password + Google)
- **Deploy to Vercel immediately** — env config, auth callback URLs, and DB pooling issues are caught incrementally, not in a final "deployment phase"
- Zod validation scaffolding

## Phase 2 — Core Tracking
- Dashboard
- Weight & body measurement logging
- Calorie logging (manual-first) + Open Food Facts integration
- Unit preference handling

## Phase 3 — Workout Planner
- Plan generator (Gemini structured output + Zod validation)
- Plan management (edit, update)

## Phase 4 — AI Coaching
- Streaming chat infrastructure
- Fortis, Vita, Lux system prompts with soft-handoff behavior
- Server-side medical-topic guardrail
- Chat history

## Phase 5 — Analytics & Streaks
- Recharts dashboards
- Progress insights
- Streak system on `DailyActivity`

## Phase 6 — Polish & Production Hardening
- Performance optimization (bundle size, cold-start mitigation)
- Error states, loading states, empty states
- Rate limiting on AI endpoints
- Final QA

---

# Future Enhancements

- Barcode scanner
- AI meal planner
- Grocery list generation
- Progress photos
- Wearable integration
- Voice-enabled AI coach
- Premium subscription features

---

# Project Vision

**Tikas: Your Fitness Companion**

*From the Tagalog "matikas" — an upright, athletic bearing. Build strength you can see, through intelligent coaching, disciplined habits, and consistent progress.*
