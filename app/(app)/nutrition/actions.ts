"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { markDailyActivity } from "@/lib/daily-activity";
import { addDays, dayStart, todayKey } from "@/lib/day";
import { foodLogSchema } from "@/lib/validations";

export type MealType = "BREAKFAST" | "LUNCH" | "DINNER" | "SNACK";

// Serializable DTO for the TanStack Query cache. Calories and macros are the
// totals for the logged amount (per the schema), so daily totals are just a sum.
export type FoodLogDTO = {
  id: string;
  mealType: MealType;
  foodName: string;
  quantity: number;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: string; // ISO
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type FoodLogInputRaw = {
  mealType: string;
  foodName: string;
  quantity: string;
  servingSize: string;
  servingUnit: string;
  calories: string;
  protein: string;
  carbs: string;
  fat: string;
};

async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");
  return session.user.id;
}

const firstIssue = (e: { issues: { message: string }[] }) =>
  e.issues[0]?.message ?? "Please check your entries.";

const toDTO = (r: {
  id: string;
  mealType: string;
  foodName: string;
  quantity: number;
  servingSize: number;
  servingUnit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  date: Date;
}): FoodLogDTO => ({
  id: r.id,
  mealType: r.mealType as MealType,
  foodName: r.foodName,
  quantity: r.quantity,
  servingSize: r.servingSize,
  servingUnit: r.servingUnit,
  calories: r.calories,
  protein: r.protein,
  carbs: r.carbs,
  fat: r.fat,
  date: r.date.toISOString(),
});

/** Today's food logs (app-day, UTC+8), matching how DailyActivity buckets. */
export async function getTodayFoodLogs(): Promise<FoodLogDTO[]> {
  const userId = await requireUserId();
  const tKey = todayKey();
  const start = dayStart(tKey);
  const end = dayStart(addDays(tKey, 1));

  const rows = await prisma.foodLog.findMany({
    where: { userId, date: { gte: start, lt: end } },
    orderBy: { date: "desc" },
  });
  return rows.map(toDTO);
}

export async function createFoodLog(
  input: FoodLogInputRaw,
): Promise<ActionResult<FoodLogDTO>> {
  const userId = await requireUserId();

  const parsed = foodLogSchema.safeParse({
    mealType: input.mealType,
    foodName: input.foodName,
    quantity: input.quantity,
    servingSize: input.servingSize,
    servingUnit: input.servingUnit,
    calories: input.calories,
    protein: input.protein,
    carbs: input.carbs,
    fat: input.fat,
    // No date field on the form — log for now.
  });

  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const d = parsed.data;
  const date = d.date ?? new Date();

  const created = await prisma.foodLog.create({
    data: {
      userId,
      mealType: d.mealType,
      foodName: d.foodName,
      quantity: d.quantity,
      servingSize: d.servingSize,
      servingUnit: d.servingUnit,
      calories: d.calories,
      protein: d.protein,
      carbs: d.carbs,
      fat: d.fat,
      date,
    },
  });

  await markDailyActivity(userId, date, { loggedFood: true });

  return { ok: true, data: toDTO(created) };
}
