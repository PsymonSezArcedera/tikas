// Timestamps are stored in UTC, but a "day" — for streaks, daily buckets, and
// "today" totals — is the user's *calendar* day. If we bucketed by the UTC day,
// a user in UTC+8 logging before 8am local would land on the previous day and a
// streak could break a day early. The app's audience/region is UTC+8 (Neon runs
// in ap-southeast-1 / Singapore), so we define a day as the UTC+8 calendar day.
//
// This constant is the single definition of "a day"; swapping to per-user
// timezones later means deriving the offset per request instead of using this.
export const DAY_OFFSET_MINUTES = 8 * 60; // UTC+8
const OFFSET_MS = DAY_OFFSET_MINUTES * 60_000;

/** "YYYY-MM-DD" of the app-day (in the reference zone) that `instant` falls in. */
export function dayKey(instant: Date): string {
  return new Date(instant.getTime() + OFFSET_MS).toISOString().slice(0, 10);
}

/**
 * A `@db.Date`-friendly Date (UTC midnight) labelled with the app-day of
 * `instant`. Prisma stores only the date part, so it reads back as the same key
 * — this is what DailyActivity.date holds.
 */
export function dayDate(instant: Date): Date {
  return new Date(`${dayKey(instant)}T00:00:00.000Z`);
}

/**
 * The UTC instant at which the given app-day *begins* (its local midnight). Use
 * for timestamp range filters: [dayStart(key), dayStart(addDays(key, 1))).
 */
export function dayStart(key: string): Date {
  return new Date(new Date(`${key}T00:00:00.000Z`).getTime() - OFFSET_MS);
}

/** The app-day key for "now". */
export function todayKey(now: Date = new Date()): string {
  return dayKey(now);
}

/**
 * A UTC instant that falls inside app-day `key`, at the same time-of-day as
 * `now`. For today this is exactly `now`; for a past day it's "now, but on that
 * date" — so a back-filled entry sorts sensibly and lands in the right day
 * bucket. Use when creating a record dated to a chosen day rather than literally
 * now.
 */
export function dayInstant(key: string, now: Date = new Date()): Date {
  const intoDay = now.getTime() - dayStart(todayKey(now)).getTime();
  return new Date(dayStart(key).getTime() + intoDay);
}

const DAY_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * A trusted app-day key. Anything malformed or in the future is clamped to
 * today — there are no future days to log or view. Used at the Server Action
 * boundary before a client-supplied key builds a date range.
 */
export function safeDayKey(key: string, now: Date = new Date()): string {
  const t = todayKey(now);
  return DAY_KEY_RE.test(key) && key <= t ? key : t;
}

/** Add `n` calendar days to a day key (handles month/year rollover). */
export function addDays(key: string, n: number): string {
  const d = new Date(`${key}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
