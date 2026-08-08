import { addDays, dayKey } from "./day";

type ActivityRow = {
  date: Date;
  loggedFood: boolean;
  loggedWeight: boolean;
  workedOut: boolean;
};

/**
 * The set of active app-day keys from DailyActivity rows. A day counts as active
 * if any flag is set. DailyActivity.date is stored as the app-day (UTC midnight
 * of the day key), so its ISO date part IS the key.
 */
export function activeDayKeys(rows: ActivityRow[]): Set<string> {
  const set = new Set<string>();
  for (const r of rows) {
    if (r.loggedFood || r.loggedWeight || r.workedOut) {
      set.add(r.date.toISOString().slice(0, 10));
    }
  }
  return set;
}

/**
 * Current streak: consecutive active days ending *today* — or *yesterday*, so an
 * as-yet-unlogged today doesn't drop a running streak (the grace day). Returns 0
 * when neither today nor yesterday is active. "Today" is the app-day for `now`
 * (UTC+8), so the boundary matches the user's calendar day, not the UTC day.
 */
export function computeStreak(active: Set<string>, now: Date = new Date()): number {
  let cursor = dayKey(now);
  if (!active.has(cursor)) {
    // Grace day: allow the streak to end yesterday before counting it broken.
    cursor = addDays(cursor, -1);
    if (!active.has(cursor)) return 0;
  }
  let streak = 0;
  while (active.has(cursor)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}
