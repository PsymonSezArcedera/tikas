import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { getLatestCoachThread } from "@/lib/chat";
import { COACHES } from "@/lib/ai/coaches";
import { CoachChat } from "@/components/coach-chat";
import { getTodayFoodLogs } from "./actions";
import { NutritionClient } from "./nutrition-client";

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
    <div className="flex flex-col gap-8">
      <NutritionClient initialLogs={initialLogs} />

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Coach chat
        </h2>
        <CoachChat
          coachId="VITA"
          coachName={COACHES.VITA.name}
          coachTitle={COACHES.VITA.title}
          initialSessionId={thread.sessionId}
          initialMessages={thread.messages}
        />
      </section>
    </div>
  );
}
