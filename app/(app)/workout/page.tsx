import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { getLatestCoachThread } from "@/lib/chat";
import { todayKey } from "@/lib/day";
import type { Unit } from "@/lib/units";
import { COACHES } from "@/lib/ai/coaches";
import { CoachChatDrawer } from "@/components/coach-chat";
import { getLatestPlan, getLiftLogs } from "./actions";
import { WorkoutClient } from "./workout-client";

export const metadata: Metadata = { title: "Workout" };

// Generation and coach chat both call Gemini — give the route room.
export const maxDuration = 60;

export default async function WorkoutPage() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  const [initialPlan, initialLifts, thread, user] = await Promise.all([
    getLatestPlan(),
    getLiftLogs(),
    getLatestCoachThread(session.user.id, "FORTIS"),
    prisma.user.findUnique({
      where: { id: session.user.id },
      select: { unitPreference: true },
    }),
  ]);

  return (
    <>
      <WorkoutClient
        initialPlan={initialPlan}
        unit={(user?.unitPreference ?? "METRIC") as Unit}
        today={todayKey()}
        initialLifts={initialLifts}
      />
      <CoachChatDrawer
        coachId="FORTIS"
        coachName={COACHES.FORTIS.name}
        coachTitle={COACHES.FORTIS.title}
        initialSessionId={thread.sessionId}
        initialMessages={thread.messages}
      />
    </>
  );
}
