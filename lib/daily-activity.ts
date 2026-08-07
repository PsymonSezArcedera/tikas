import { prisma } from "./db";

// Streaks read from DailyActivity — one row per user per day. We normalise to a
// UTC day to match the @db.Date column and the [userId, date] unique key.
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

type ActivityFlags = {
  loggedFood?: boolean;
  loggedWeight?: boolean;
  workedOut?: boolean;
};

/**
 * Flip activity flags for the given day, creating the row on first log and only
 * updating the passed flags on later logs (others keep their value).
 */
export async function markDailyActivity(
  userId: string,
  when: Date,
  flags: ActivityFlags,
): Promise<void> {
  const date = startOfUtcDay(when);
  await prisma.dailyActivity.upsert({
    where: { userId_date: { userId, date } },
    create: { userId, date, ...flags },
    update: { ...flags },
  });
}
