"use client";

import { useQueryClient } from "@tanstack/react-query";

import {
  CoachChatDrawer,
  type FoodProposal,
} from "@/components/coach-chat";
import { createFoodLog } from "./actions";

const FOOD_KEY = ["foodLogs"] as const;

type Props = {
  coachName: string;
  coachTitle: string;
  initialSessionId: string | null;
  initialMessages: { id: string; role: "USER" | "ASSISTANT"; content: string }[];
};

/**
 * Vita's drawer on /nutrition, wired for agentic food logging. A confirmed
 * proposal routes through the same createFoodLog Server Action the manual form
 * uses (so DailyActivity.loggedFood flips and daily totals update), then
 * invalidates the food-log query so the page reflects the new entry.
 */
export function VitaChatDrawer(props: Props) {
  const qc = useQueryClient();

  async function onConfirmProposal(p: FoodProposal) {
    const res = await createFoodLog({
      mealType: p.mealType,
      foodName: p.foodName,
      quantity: String(p.quantity),
      servingSize: String(p.servingSize),
      servingUnit: p.servingUnit,
      calories: String(p.calories),
      protein: String(p.protein),
      carbs: String(p.carbs),
      fat: String(p.fat),
    });

    if (!res.ok) {
      return { ok: false, message: res.error };
    }

    await qc.invalidateQueries({ queryKey: FOOD_KEY });
    return { ok: true, message: `Logged ${res.data.foodName} to your diary.` };
  }

  return (
    <CoachChatDrawer
      coachId="VITA"
      {...props}
      onConfirmProposal={onConfirmProposal}
    />
  );
}
