import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Dumbbell, Flame, PieChart, Scale, Target, Utensils } from "lucide-react";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { startOfUtcDay } from "@/lib/daily-activity";
import { kgToDisplay, weightUnitLabel, type Unit } from "@/lib/units";
import {
  EmptyStat,
  MacroCol,
  StatCard,
  StatHero,
  Trend,
} from "./dashboard-cards";

export const metadata: Metadata = { title: "Dashboard" };

const DAY_MS = 24 * 60 * 60 * 1000;
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

// Consecutive active days ending today — or yesterday, so an as-yet-unlogged
// today doesn't drop a running streak. Reads from DailyActivity only.
function computeStreak(activeDays: Set<string>, today: Date): number {
  let cursor = startOfUtcDay(today);
  if (!activeDays.has(isoDay(cursor))) {
    cursor = new Date(cursor.getTime() - DAY_MS);
    if (!activeDays.has(isoDay(cursor))) return 0;
  }
  let streak = 0;
  while (activeDays.has(isoDay(cursor))) {
    streak++;
    cursor = new Date(cursor.getTime() - DAY_MS);
  }
  return streak;
}

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  const userId = session.user.id;

  const now = new Date();
  const today = startOfUtcDay(now);
  const tomorrow = new Date(today.getTime() + DAY_MS);
  const streakSince = new Date(today.getTime() - 366 * DAY_MS);

  // One parallel read across the three logging tables.
  const [user, weightLogs, foodAgg, activities] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { unitPreference: true, goalWeight: true },
    }),
    prisma.weightLog.findMany({
      where: { userId },
      orderBy: { date: "desc" },
      take: 2,
      select: { weight: true },
    }),
    prisma.foodLog.aggregate({
      where: { userId, date: { gte: today, lt: tomorrow } },
      _sum: { calories: true, protein: true, carbs: true, fat: true },
      _count: true,
    }),
    prisma.dailyActivity.findMany({
      where: { userId, date: { gte: streakSince } },
      select: {
        date: true,
        loggedFood: true,
        loggedWeight: true,
        workedOut: true,
      },
    }),
  ]);

  const unit = (user?.unitPreference ?? "METRIC") as Unit;
  const goalKg = user?.goalWeight ?? null;
  const wUnit = weightUnitLabel(unit);

  // Weight + trend
  const latest = weightLogs[0] ?? null;
  const previous = weightLogs[1] ?? null;
  let trend: { delta: number; tone: "success" | "danger" | "muted" } | null =
    null;
  if (latest && previous) {
    const delta =
      Math.round(
        (kgToDisplay(latest.weight, unit) -
          kgToDisplay(previous.weight, unit)) *
          10,
      ) / 10;
    let tone: "success" | "danger" | "muted" = "muted";
    if (delta !== 0 && goalKg != null) {
      const distNow = Math.abs(latest.weight - goalKg);
      const distPrev = Math.abs(previous.weight - goalKg);
      tone = distNow < distPrev ? "success" : distNow > distPrev ? "danger" : "muted";
    } else if (delta !== 0) {
      tone = delta < 0 ? "success" : "danger"; // no goal: treat a drop as progress
    }
    trend = { delta, tone };
  }

  // Food today
  const foodCount = foodAgg._count;
  const calories = Math.round(foodAgg._sum.calories ?? 0);
  const protein = Math.round(foodAgg._sum.protein ?? 0);
  const carbs = Math.round(foodAgg._sum.carbs ?? 0);
  const fat = Math.round(foodAgg._sum.fat ?? 0);

  // Streak
  const activeDays = new Set<string>();
  for (const a of activities) {
    if (a.loggedFood || a.loggedWeight || a.workedOut) activeDays.add(isoDay(a.date));
  }
  const hasActivity = activeDays.size > 0;
  const streak = computeStreak(activeDays, now);

  // Progress to goal
  let progress:
    | { remaining: number; reached: boolean; direction: "lose" | "gain"; goal: number }
    | null = null;
  if (latest && goalKg != null) {
    const diff = latest.weight - goalKg;
    progress = {
      remaining: kgToDisplay(Math.abs(diff), unit),
      reached: Math.abs(diff) < 0.05,
      direction: diff > 0 ? "lose" : "gain",
      goal: kgToDisplay(goalKg, unit),
    };
  }

  const firstName = session.user.name?.trim().split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="font-display text-2xl font-semibold tracking-tight">
          {firstName ? `Welcome back, ${firstName}` : "Dashboard"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Your fitness overview at a glance.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* Current weight */}
        <StatCard label="Current weight" icon={Scale}>
          {latest ? (
            <div className="flex flex-col gap-1.5">
              <StatHero value={kgToDisplay(latest.weight, unit)} unit={wUnit} />
              {trend ? (
                <Trend delta={trend.delta} unit={wUnit} tone={trend.tone} />
              ) : (
                <p className="text-sm text-muted-foreground">First entry logged</p>
              )}
            </div>
          ) : (
            <EmptyStat
              message="No weigh-ins yet."
              cta="Log your first weigh-in"
              href="/tracking"
            />
          )}
        </StatCard>

        {/* Calories today */}
        <StatCard label="Calories today" icon={Utensils}>
          {foodCount > 0 ? (
            <div className="flex flex-col gap-1.5">
              <StatHero value={calories} unit="kcal" />
              <p className="text-sm text-muted-foreground">
                {foodCount} {foodCount === 1 ? "item" : "items"} logged
              </p>
            </div>
          ) : (
            <EmptyStat
              message="No meals logged yet."
              cta="Log a meal"
              href="/nutrition"
            />
          )}
        </StatCard>

        {/* Streak */}
        <StatCard label="Streak" icon={Flame}>
          {hasActivity ? (
            <div className="flex flex-col gap-1.5">
              <StatHero value={streak} unit={streak === 1 ? "day" : "days"} />
              <p className="text-sm text-muted-foreground">
                {streak > 0 ? "Keep it going" : "Log today to restart"}
              </p>
            </div>
          ) : (
            <EmptyStat
              message="No streak yet."
              cta="Log to get started"
              href="/nutrition"
            />
          )}
        </StatCard>

        {/* Macros today */}
        <StatCard label="Macros today" icon={PieChart}>
          {foodCount > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              <MacroCol label="Protein" grams={protein} />
              <MacroCol label="Carbs" grams={carbs} />
              <MacroCol label="Fat" grams={fat} />
            </div>
          ) : (
            <EmptyStat
              message="No meals logged yet."
              cta="Log a meal"
              href="/nutrition"
            />
          )}
        </StatCard>

        {/* Workouts — Phase 3 */}
        <StatCard label="Workouts" icon={Dumbbell}>
          <div className="flex flex-col gap-1.5">
            <StatHero value="—" className="text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Arrives with the workout planner.
            </p>
          </div>
        </StatCard>

        {/* Progress to goal */}
        <StatCard label="Progress to goal" icon={Target}>
          {progress ? (
            progress.reached ? (
              <div className="flex flex-col gap-1.5">
                <StatHero value="0" unit={wUnit} />
                <p className="text-sm text-muted-foreground">
                  You&apos;re at your goal weight 🎉
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-1.5">
                <StatHero value={progress.remaining} unit={wUnit} />
                <p className="text-sm text-muted-foreground">
                  to {progress.direction} · goal {progress.goal} {wUnit}
                </p>
              </div>
            )
          ) : (
            <EmptyStat
              message="No weigh-ins yet."
              cta="Log a weigh-in"
              href="/tracking"
            />
          )}
        </StatCard>
      </div>
    </div>
  );
}
