import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { getLatestCoachThread } from "@/lib/chat";
import { COACHES } from "@/lib/ai/coaches";
import { getTodayFoodLogs } from "./actions";
import { NutritionClient } from "./nutrition-client";
import { VitaChatDrawer } from "./vita-chat-drawer";

export const metadata: Metadata = { title: "Nutrition" };

// Vita's chat calls Gemini — give the route room.
export const maxDuration = 60;

export default async function NutritionPage() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  // Food-logging seed data (server-rendered) and Vita's latest thread, together.
  const [initialLogs, thread] = await Promise.all([
    getTodayFoodLogs(),
    getLatestCoachThread(session.user.id, "VITA"),
  ]);

  return (
    <>
      <NutritionClient initialLogs={initialLogs} />
      <VitaChatDrawer
        coachName={COACHES.VITA.name}
        coachTitle={COACHES.VITA.title}
        initialSessionId={thread.sessionId}
        initialMessages={thread.messages}
      />
    </>
  );
}
