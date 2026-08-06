import { z } from "zod";

import { optionalPastDate } from "./shared";

// Mirrors the Prisma MealType enum.
export const mealTypeEnum = z.enum(["BREAKFAST", "LUNCH", "DINNER", "SNACK"]);

/**
 * Food log entry (manual-first logging path). `quantity` is the number of
 * servings consumed; `servingSize` is grams/ml per serving; `servingUnit` is a
 * free-form unit (g | ml | piece | cup | ...). Calories and macros are per the
 * logged amount and must be non-negative. `date` defaults to now in the Server
 * Action when omitted. Also reused to parse AI-suggested food entries.
 */
export const foodLogSchema = z.object({
  mealType: mealTypeEnum,
  foodName: z.string().trim().min(1).max(200),
  quantity: z.coerce.number().positive(), // number of servings
  servingSize: z.coerce.number().positive(), // grams/ml per serving
  servingUnit: z.string().trim().min(1).max(20), // g | ml | piece | cup | ...
  calories: z.coerce.number().min(0),
  protein: z.coerce.number().min(0), // grams
  carbs: z.coerce.number().min(0), // grams
  fat: z.coerce.number().min(0), // grams
  date: optionalPastDate,
});

export type FoodLogInput = z.infer<typeof foodLogSchema>;
