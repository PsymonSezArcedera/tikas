import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { addDays, dayKey, dayStart, todayKey } from "@/lib/day";
import { activeDayKeys } from "@/lib/streak";
import { kgToDisplay, weightUnitLabel, type Unit } from "@/lib/units";
import {
  ActivityFrequencyChart,
  BmiTrendChart,
  CalorieTrendChart,
  MacroSplitChart,
  WeightTrendChart,
} from "./analytics-charts";

export const metadata: Metadata = { title: "Analytics" };

// Fixed locale + UTC so the label is deterministic (server == client). The keys
// are already app-day dates, so formatting their UTC parts reads correctly.
const label = (key: string) =>
  new Date(`${key}T00:00:00.000Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  });

// Monday-start week key for a given day key.
function weekStartKey(key: string): string {
  const d = new Date(`${key}T00:00:00.000Z`);
  const mondayOffset = (d.getUTCDay() + 6) % 7; // Mon=0 … Sun=6
  d.setUTCDate(d.getUTCDate() - mondayOffset);
  return d.toISOString().slice(0, 10);
}

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  const userId = session.user.id;

  const tKey = todayKey();
  const foodSince = dayStart(addDays(tKey, -29)); // 30-day window (instants)
  const activitySince = new Date(`${addDays(tKey, -63)}T00:00:00.000Z`); // ~9 weeks

  const [user, weightLogs, foodLogs, activities] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { unitPreference: true, goalWeight: true, height: true },
    }),
    prisma.weightLog.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      select: { weight: true, date: true },
    }),
    prisma.foodLog.findMany({
      where: { userId, date: { gte: foodSince } },
      orderBy: { date: "asc" },
      select: { date: true, calories: true, protein: true, carbs: true, fat: true },
    }),
    prisma.dailyActivity.findMany({
      where: { userId, date: { gte: activitySince } },
      select: { date: true, loggedFood: true, loggedWeight: true, workedOut: true },
    }),
  ]);

  const unit = (user?.unitPreference ?? "METRIC") as Unit;
  const goalKg = user?.goalWeight ?? null;
  const heightCm = user?.height ?? null;

  // Weight trend — convert metric → display units.
  const weightData = weightLogs.map((w) => ({
    label: label(dayKey(w.date)),
    weight: kgToDisplay(w.weight, unit),
  }));
  const goal = goalKg != null ? kgToDisplay(goalKg, unit) : null;

  // BMI progression — weight (kg) / height (m)². Height is a single profile
  // value, so BMI tracks weight; unitless, no display conversion.
  const heightM = heightCm != null ? heightCm / 100 : null;
  const bmiData =
    heightM && heightM > 0
      ? weightLogs.map((w) => ({
          label: label(dayKey(w.date)),
          bmi: Math.round((w.weight / (heightM * heightM)) * 10) / 10,
        }))
      : [];

  // Calorie trend (daily totals, app-day) + macro totals over the window.
  const byDay = new Map<string, number>();
  const macros = { protein: 0, carbs: 0, fat: 0 };
  for (const f of foodLogs) {
    const key = dayKey(f.date);
    byDay.set(key, (byDay.get(key) ?? 0) + f.calories);
    macros.protein += f.protein;
    macros.carbs += f.carbs;
    macros.fat += f.fat;
  }
  const calorieData = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, calories]) => ({ label: label(key), calories: Math.round(calories) }));

  // Weekly activity — active days (any log) per week, last 8 weeks (incl. zeros).
  const active = activeDayKeys(activities);
  const thisWeek = weekStartKey(tKey);
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const key = weekStartKey(addDays(thisWeek, -7 * (7 - i)));
    return { key, label: label(key), days: 0 };
  });
  const weekIndex = new Map(weeks.map((w, i) => [w.key, i]));
  for (const k of active) {
    const idx = weekIndex.get(weekStartKey(k));
    if (idx != null) weeks[idx].days += 1;
  }
  const activityData = weeks.map((w) => ({ label: w.label, days: w.days }));
  const hasActivity = weeks.some((w) => w.days > 0);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <BarChart3 className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Your trends over time, in {unit === "IMPERIAL" ? "imperial" : "metric"} units.
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="lg:col-span-2">
          <WeightTrendChart
            data={weightData}
            unitLabel={weightUnitLabel(unit)}
            goal={goal}
          />
        </div>
        <div className="lg:col-span-2">
          <BmiTrendChart data={bmiData} />
        </div>
        <CalorieTrendChart data={calorieData} />
        <MacroSplitChart
          protein={macros.protein}
          carbs={macros.carbs}
          fat={macros.fat}
          periodLabel="last 30 days"
        />
        <div className="lg:col-span-2">
          <ActivityFrequencyChart data={activityData} hasActivity={hasActivity} />
        </div>
      </div>
    </div>
  );
}
