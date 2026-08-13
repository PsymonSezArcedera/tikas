import { prisma } from "@/lib/db";

/**
 * Per-user rate limiting for the AI endpoints — the ones that call Gemini: coach
 * chat, Vita's food-logging tool-calls, and workout generation. Left unbounded,
 * a user (or a bot on their session) could spam these and burn the Gemini daily
 * quota / rack up cost.
 *
 * The counters live in Postgres (Neon) via the existing Prisma client. On Vercel
 * serverless there's no memory shared between requests, so an in-process counter
 * wouldn't work; a durable store is required. Using Neon here means no extra
 * dependency, service, or secret to provision — the trade vs Redis/Upstash is
 * that this is a fixed-window counter (a small burst can straddle a window edge)
 * rather than a sliding window with native atomic TTLs. For capping per-user AI
 * usage that's plenty.
 *
 * Two windows per user, a shared budget across all AI endpoints so what's capped
 * is *total* Gemini usage: a short burst cap (per minute) and a quota cap (per
 * day). Both are tunable via env vars.
 */

const num = (v: string | undefined, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

// Defaults chosen to be generous for a real user (chatting + the occasional plan)
// but tight enough to stop spam/bots. Override per environment via Vercel env.
export const AI_RATE_LIMIT = {
  perMinute: num(process.env.AI_RATE_LIMIT_PER_MINUTE, 10),
  perDay: num(process.env.AI_RATE_LIMIT_PER_DAY, 100),
};

const MINUTE_MS = 60_000;
const DAY_MS = 86_400_000;

export type RateLimitResult =
  | { ok: true }
  | { ok: false; scope: "minute" | "day"; retryAfterSeconds: number };

/**
 * Atomically count one hit against a window and return the new count. A single
 * upsert does it: if the stored window matches, increment; if a new window has
 * started, reset to 1. The ON CONFLICT update locks the row, so concurrent
 * requests from the same user can't race past the cap.
 */
async function bump(key: string, windowStart: Date): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: number }[]>`
    INSERT INTO "RateLimit" ("key", "count", "windowStart")
    VALUES (${key}, 1, ${windowStart})
    ON CONFLICT ("key") DO UPDATE SET
      "count" = CASE
        WHEN "RateLimit"."windowStart" = ${windowStart}
        THEN "RateLimit"."count" + 1
        ELSE 1
      END,
      "windowStart" = ${windowStart}
    RETURNING "count";
  `;
  return Number(rows[0]?.count ?? 1);
}

/**
 * Count one AI request against the user's budget and report whether it's allowed.
 * Keyed on the session user id — never global — so one heavy user can't lock
 * everyone else out. Call immediately before a Gemini call; on `{ ok: false }`,
 * skip the call and surface aiRateLimitMessage(result).
 *
 * The minute window is checked (and consumed) first: a minute-blocked request
 * doesn't also spend the day quota.
 */
export async function checkAiRateLimit(
  userId: string,
  limits = AI_RATE_LIMIT,
): Promise<RateLimitResult> {
  const now = Date.now();
  const minuteStart = new Date(Math.floor(now / MINUTE_MS) * MINUTE_MS);
  const dayStart = new Date(Math.floor(now / DAY_MS) * DAY_MS);

  const minuteCount = await bump(`${userId}:ai:minute`, minuteStart);
  if (minuteCount > limits.perMinute) {
    return {
      ok: false,
      scope: "minute",
      retryAfterSeconds: Math.max(
        Math.ceil((minuteStart.getTime() + MINUTE_MS - now) / 1000),
        1,
      ),
    };
  }

  const dayCount = await bump(`${userId}:ai:day`, dayStart);
  if (dayCount > limits.perDay) {
    return {
      ok: false,
      scope: "day",
      retryAfterSeconds: Math.max(
        Math.ceil((dayStart.getTime() + DAY_MS - now) / 1000),
        1,
      ),
    };
  }

  return { ok: true };
}

/**
 * Friendly, non-crashy message for a blocked request, in the coaches' voice.
 * The day cap points at "tomorrow"; the per-minute cap is transient.
 */
export function aiRateLimitMessage(
  result: Extract<RateLimitResult, { ok: false }>,
): string {
  if (result.scope === "day") {
    return "You've reached today's usage limit for the AI coaches. Please try again tomorrow.";
  }
  return "You've reached the limit for now — please try again in a bit.";
}
