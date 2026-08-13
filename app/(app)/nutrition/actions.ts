"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { markDailyActivity, reevaluateLoggedFood } from "@/lib/daily-activity";
import { addDays, dayInstant, dayStart, safeDayKey, todayKey } from "@/lib/day";
import { foodLogSchema } from "@/lib/validations";
import { OffError, searchFoods } from "@/lib/off";

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

// A search result from Open Food Facts, ready to auto-fill the log form. Macros
// are per 100 g (the search index basis); the form seeds serving = 100 g and the
// user adjusts quantity from there.
export type FoodSearchResultDTO = {
  code: string;
  name: string;
  brand: string | null;
  calories: number; // per 100 g
  protein: number;
  carbs: number;
  fat: number;
};

/**
 * Search Open Food Facts by food name for the manual log form. Returns real,
 * sourced products (calories/macros per 100 g). Empty query → no results; an OFF
 * outage or rate-limit returns a friendly error so the user just types manually.
 */
export async function searchFoodProducts(
  query: string,
): Promise<ActionResult<FoodSearchResultDTO[]>> {
  await requireUserId();

  const q = query.trim();
  if (q.length < 2) return { ok: true, data: [] };

  try {
    const products = await searchFoods(q, 8);
    return {
      ok: true,
      data: products.map((p) => ({
        code: p.code,
        name: p.name,
        brand: p.brand,
        calories: p.per100g.calories,
        protein: p.per100g.protein,
        carbs: p.per100g.carbs,
        fat: p.per100g.fat,
      })),
    };
  } catch (err) {
    if (err instanceof OffError && err.reason === "rate_limited") {
      return {
        ok: false,
        error: "Food search is busy right now — try again shortly, or enter it manually.",
      };
    }
    return {
      ok: false,
      error: "Couldn't reach the food database — enter the details manually.",
    };
  }
}

/**
 * Food logs for a given app-day (UTC+8, matching how DailyActivity buckets).
 * `key` is a "YYYY-MM-DD" day key; anything invalid or in the future falls back
 * to today.
 */
export async function getFoodLogsForDay(key: string): Promise<FoodLogDTO[]> {
  const userId = await requireUserId();
  const day = safeDayKey(key);
  const start = dayStart(day);
  const end = dayStart(addDays(day, 1));

  const rows = await prisma.foodLog.findMany({
    where: { userId, date: { gte: start, lt: end } },
    orderBy: { date: "desc" },
  });
  return rows.map(toDTO);
}

/** Convenience wrapper — today's food logs. */
export async function getTodayFoodLogs(): Promise<FoodLogDTO[]> {
  return getFoodLogsForDay(todayKey());
}

/**
 * Create a food entry on `dayKey` (defaults to today). The entry is dated to
 * that app-day so it appears under the right date and DailyActivity.loggedFood
 * flips for that day — this is what lets a user back-fill a past day.
 */
export async function createFoodLog(
  input: FoodLogInputRaw,
  dayKey: string = todayKey(),
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
  });

  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const d = parsed.data;
  const date = d.date ?? dayInstant(safeDayKey(dayKey));

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

/**
 * Edit an existing entry. Re-validated with the same schema as create; the row's
 * `date` is preserved (the form has no date field), so the day bucket is
 * unchanged and DailyActivity needs no re-evaluation — there's still ≥1 entry
 * that day. Ownership is checked before the write.
 */
export async function updateFoodLog(
  id: string,
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
  });

  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const existing = await prisma.foodLog.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false, error: "That entry no longer exists." };
  }

  const d = parsed.data;
  const updated = await prisma.foodLog.update({
    where: { id },
    data: {
      mealType: d.mealType,
      foodName: d.foodName,
      quantity: d.quantity,
      servingSize: d.servingSize,
      servingUnit: d.servingUnit,
      calories: d.calories,
      protein: d.protein,
      carbs: d.carbs,
      fat: d.fat,
      // date intentionally unchanged — keep the entry on its original day.
    },
  });

  return { ok: true, data: toDTO(updated) };
}

/**
 * Delete an entry (ownership-checked). Afterwards re-evaluate the day's
 * `loggedFood` flag: if that was the last food for the day, it flips back to
 * false so streaks stay accurate.
 */
export async function deleteFoodLog(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();

  const existing = await prisma.foodLog.findFirst({
    where: { id, userId },
    select: { id: true, date: true },
  });
  if (!existing) {
    return { ok: false, error: "That entry no longer exists." };
  }

  await prisma.foodLog.delete({ where: { id } });
  await reevaluateLoggedFood(userId, existing.date);

  return { ok: true, data: { id } };
}
