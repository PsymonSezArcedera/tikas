import { prisma } from "./db";
import { addDays, dayDate, dayKey, dayStart } from "./day";

type ActivityFlags = {
  loggedFood?: boolean;
  loggedWeight?: boolean;
  workedOut?: boolean;
};

/**
 * Flip activity flags for the app-day the log falls in, creating the row on the
 * first log and only updating the passed flags on later logs (others keep their
 * value). The day is the UTC+8 calendar day (see lib/day.ts) so it lines up with
 * how streaks are read back.
 */
export async function markDailyActivity(
  userId: string,
  when: Date,
  flags: ActivityFlags,
): Promise<void> {
  const date = dayDate(when);
  await prisma.dailyActivity.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...flags },
    update: { ...flags },
  });
}

/**
 * After a delete, re-derive a streak flag for the entry's app-day: if no entries
 * of that kind remain for the day, flip the flag back to false so the streak
 * stays accurate; if any remain, leave it (still true). `countRemaining` is the
 * per-model day count. Uses updateMany so a missing DailyActivity row is a
 * harmless no-op — we never create an all-false row just because of a delete.
 */
async function reevaluateFlag(
  userId: string,
  when: Date,
  countRemaining: (range: { gte: Date; lt: Date }) => Promise<number>,
  flag: ActivityFlags,
): Promise<void> {
  const key = dayKey(when);
  const remaining = await countRemaining({
    gte: dayStart(key),
    lt: dayStart(addDays(key, 1)),
  });
  if (remaining === 0) {
    await prisma.dailyActivity.updateMany({
      where: { userId, date: dayDate(when) },
      data: flag,
    });
  }
}

/** Re-derive `loggedFood` for the entry's day after a food-log delete. */
export function reevaluateLoggedFood(userId: string, when: Date): Promise<void> {
  return reevaluateFlag(
    userId,
    when,
    ({ gte, lt }) =>
      prisma.foodLog.count({ where: { userId, date: { gte, lt } } }),
    { loggedFood: false },
  );
}

/** Re-derive `loggedWeight` for the entry's day after a weight-log delete. */
export function reevaluateLoggedWeight(
  userId: string,
  when: Date,
): Promise<void> {
  return reevaluateFlag(
    userId,
    when,
    ({ gte, lt }) =>
      prisma.weightLog.count({ where: { userId, date: { gte, lt } } }),
    { loggedWeight: false },
  );
}
