import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { getLatestPlan } from "./actions";
import { WorkoutClient } from "./workout-client";

export const metadata: Metadata = { title: "Workout" };

// Generation calls Gemini, which can take several seconds — give the action room.
export const maxDuration = 60;

export default async function WorkoutPage() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  const initialPlan = await getLatestPlan();

  return <WorkoutClient initialPlan={initialPlan} />;
}
