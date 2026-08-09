import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { getLatestCoachThread } from "@/lib/chat";
import { todayKey } from "@/lib/day";
import { COACHES } from "@/lib/ai/coaches";
import { getFoodLogsForDay } from "./actions";
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

  // Server-computed app-day (UTC+8) so the client's default day and "no future
  // days" ceiling match how logging/streaks bucket, not the browser's local day.
  const today = todayKey();

  // Food-logging seed data (server-rendered) and Vita's latest thread, together.
  const [initialLogs, thread] = await Promise.all([
    getFoodLogsForDay(today),
    getLatestCoachThread(session.user.id, "VITA"),
  ]);

  return (
    <>
      <NutritionClient initialLogs={initialLogs} today={today} />
      <VitaChatDrawer
        coachName={COACHES.VITA.name}
        coachTitle={COACHES.VITA.title}
        initialSessionId={thread.sessionId}
        initialMessages={thread.messages}
      />
    </>
  );
}
