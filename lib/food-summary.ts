// Dependency-free helpers for presenting a food-log proposal in prose. Shared by
// the coach route (server — builds the message it persists) and the chat UI
// (client — the live source label) so both read identically and stay honest
// about where the numbers came from.

export type FoodSource = "estimate" | "off";

export type NutritionFacts = {
  foodName: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
};

// Grammar-neutral: an em-dash instead of "is"/"are" so it reads right whether the
// food name is singular ("Grilled chicken breast") or plural ("Two scrambled
// eggs"). Numbers are rounded for prose; the editable fields keep exact values.
export function nutritionSummary(f: NutritionFacts): string {
  return `${f.foodName.trim()} — roughly ${Math.round(f.calories)} cal, ${Math.round(
    f.protein,
  )}g protein, ${Math.round(f.carbs)}g carbs, ${Math.round(f.fat)}g fat.`;
}

// Honest per-source label. "estimate" is all Vita produces today; "off" is ready
// for when Open Food Facts lookup lands, so real data can read differently.
export const SOURCE_LABEL: Record<FoodSource, string> = {
  estimate: "Vita's estimate — adjust if you know better.",
  off: "From Open Food Facts — adjust if yours differs.",
};
