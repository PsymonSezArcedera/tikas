import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { getTodayFoodLogs } from "./actions";
import { NutritionClient } from "./nutrition-client";

export const metadata: Metadata = { title: "Nutrition" };

export default async function NutritionPage() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  // Fetched on the server for a no-flash first paint; TanStack Query takes over
  // on the client (optimistic inserts, refetch after each mutation).
  const initialLogs = await getTodayFoodLogs();

  return <NutritionClient initialLogs={initialLogs} />;
}
