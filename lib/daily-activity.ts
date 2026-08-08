import { prisma } from "./db";
import { dayDate } from "./day";

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
