import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { BarChart3 } from "lucide-react";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { startOfUtcDay } from "@/lib/daily-activity";
import { kgToDisplay, weightUnitLabel, type Unit } from "@/lib/units";
import {
  CalorieTrendChart,
  MacroSplitChart,
  WeightTrendChart,
} from "./analytics-charts";

export const metadata: Metadata = { title: "Analytics" };

const DAY_MS = 24 * 60 * 60 * 1000;

// Fixed locale + UTC so the label is deterministic (server == client).
const dayLabel = (d: Date) =>
  d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const isoDay = (d: Date) => d.toISOString().slice(0, 10);

export default async function AnalyticsPage() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }
  const userId = session.user.id;

  const today = startOfUtcDay(new Date());
  const since = new Date(today.getTime() - 29 * DAY_MS); // 30-day window

  // One parallel read across the sources this page needs.
  const [user, weightLogs, foodLogs] = await Promise.all([
    prisma.user.findUnique({
      where: { id: userId },
      select: { unitPreference: true, goalWeight: true },
    }),
    prisma.weightLog.findMany({
      where: { userId },
      orderBy: { date: "asc" },
      select: { weight: true, date: true },
    }),
    prisma.foodLog.findMany({
      where: { userId, date: { gte: since } },
      orderBy: { date: "asc" },
      select: { date: true, calories: true, protein: true, carbs: true, fat: true },
    }),
  ]);

  const unit = (user?.unitPreference ?? "METRIC") as Unit;
  const goalKg = user?.goalWeight ?? null;

  // Weight trend — convert metric → display units.
  const weightData = weightLogs.map((w) => ({
    label: dayLabel(w.date),
    weight: kgToDisplay(w.weight, unit),
  }));
  const goal = goalKg != null ? kgToDisplay(goalKg, unit) : null;

  // Calorie trend — daily totals over the window (only days with logs).
  const byDay = new Map<string, number>();
  const macros = { protein: 0, carbs: 0, fat: 0 };
  for (const f of foodLogs) {
    const key = isoDay(startOfUtcDay(f.date));
    byDay.set(key, (byDay.get(key) ?? 0) + f.calories);
    macros.protein += f.protein;
    macros.carbs += f.carbs;
    macros.fat += f.fat;
  }
  const calorieData = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, calories]) => ({
      label: dayLabel(new Date(`${key}T00:00:00.000Z`)),
      calories: Math.round(calories),
    }));

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
        <CalorieTrendChart data={calorieData} />
        <MacroSplitChart
          protein={macros.protein}
          carbs={macros.carbs}
          fat={macros.fat}
          periodLabel="last 30 days"
        />
      </div>
    </div>
  );
}
