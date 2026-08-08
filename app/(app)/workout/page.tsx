import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { getSession } from "@/lib/session";
import { getLatestCoachThread } from "@/lib/chat";
import { COACHES } from "@/lib/ai/coaches";
import { CoachChat } from "@/components/coach-chat";
import { getLatestPlan } from "./actions";
import { WorkoutClient } from "./workout-client";

export const metadata: Metadata = { title: "Workout" };

// Generation and coach chat both call Gemini — give the route room.
export const maxDuration = 60;

export default async function WorkoutPage() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  const [initialPlan, thread] = await Promise.all([
    getLatestPlan(),
    getLatestCoachThread(session.user.id, "FORTIS"),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <WorkoutClient initialPlan={initialPlan} />

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-lg font-semibold tracking-tight">
          Coach chat
        </h2>
        <CoachChat
          coachId="FORTIS"
          coachName={COACHES.FORTIS.name}
          coachTitle={COACHES.FORTIS.title}
          initialSessionId={thread.sessionId}
          initialMessages={thread.messages}
        />
      </section>
    </div>
  );
}
