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
 * Re-derive `loggedFood` for the app-day `when` falls in, after a food entry is
 * removed. If no food remains for that day, flip the flag back to false so the
 * streak stays accurate; if any remains, leave it (still true). Uses updateMany
 * so a missing DailyActivity row is a harmless no-op — we never create an
 * all-false row just because a delete happened.
 */
export async function reevaluateLoggedFood(
  userId: string,
  when: Date,
): Promise<void> {
  const key = dayKey(when);
  const remaining = await prisma.foodLog.count({
    where: {
      userId,
      date: { gte: dayStart(key), lt: dayStart(addDays(key, 1)) },
    },
  });
  if (remaining === 0) {
    await prisma.dailyActivity.updateMany({
      where: { userId, date: dayDate(when) },
      data: { loggedFood: false },
    });
  }
}
