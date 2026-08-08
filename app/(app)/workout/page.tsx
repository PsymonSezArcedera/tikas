import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { COACHES } from "@/lib/ai/coaches";
import { getLatestPlan } from "./actions";
import { WorkoutClient } from "./workout-client";
import { CoachChat } from "./coach-chat";

export const metadata: Metadata = { title: "Workout" };

// Generation and coach chat both call Gemini — give the route room.
export const maxDuration = 60;

export default async function WorkoutPage() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  // Most recent Fortis conversation, so reopening the page restores the thread.
  const [initialPlan, fortisSession] = await Promise.all([
    getLatestPlan(),
    prisma.chatSession.findFirst({
      where: { userId: session.user.id, coachType: "FORTIS" },
      orderBy: { createdAt: "desc" },
      include: { messages: { orderBy: { timestamp: "asc" } } },
    }),
  ]);

  const initialMessages =
    fortisSession?.messages.map((m) => ({
      id: m.id,
      role: m.role,
      content: m.message,
    })) ?? [];

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
          initialSessionId={fortisSession?.id ?? null}
          initialMessages={initialMessages}
        />
      </section>
    </div>
  );
}
