import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Sparkles } from "lucide-react";

import { getSession } from "@/lib/session";
import { getLatestCoachThread } from "@/lib/chat";
import { COACHES } from "@/lib/ai/coaches";
import { CoachChat } from "@/components/coach-chat";

export const metadata: Metadata = { title: "Wellness" };

// Lux's chat calls Gemini — give the route room.
export const maxDuration = 60;

export default async function WellnessPage() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  const thread = await getLatestCoachThread(session.user.id, "LUX");

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Sparkles className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Wellness
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sleep, recovery, stress, and habits with Lux, your wellness coach.
          </p>
        </div>
      </header>

      <CoachChat
        coachId="LUX"
        coachName={COACHES.LUX.name}
        coachTitle={COACHES.LUX.title}
        initialSessionId={thread.sessionId}
        initialMessages={thread.messages}
      />
    </div>
  );
}
