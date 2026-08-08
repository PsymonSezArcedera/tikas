import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { HeartPulse, Moon, Repeat, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { getSession } from "@/lib/session";
import { getLatestCoachThread } from "@/lib/chat";
import { COACHES } from "@/lib/ai/coaches";
import { CoachChatDrawer } from "@/components/coach-chat";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = { title: "Wellness" };

// Lux's chat calls Gemini — give the route room.
export const maxDuration = 60;

const TOPICS: { icon: LucideIcon; title: string; desc: string }[] = [
  { icon: Moon, title: "Sleep", desc: "Wind-down routines, timing, and quality." },
  { icon: HeartPulse, title: "Recovery", desc: "Rest days, stress load, and bouncing back." },
  { icon: Repeat, title: "Habits", desc: "Building consistency and staying motivated." },
];

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

      <div className="grid gap-4 sm:grid-cols-3">
        {TOPICS.map(({ icon: Icon, title, desc }) => (
          <Card key={title} className="gap-3 p-5">
            <span className="flex size-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="size-4.5" />
            </span>
            <div>
              <h2 className="font-display text-base font-semibold tracking-tight">
                {title}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
            </div>
          </Card>
        ))}
      </div>

      <p className="text-sm text-muted-foreground">
        Tap{" "}
        <span className="font-medium text-foreground">Ask Lux</span> to chat
        about any of these.
      </p>

      <CoachChatDrawer
        coachId="LUX"
        coachName={COACHES.LUX.name}
        coachTitle={COACHES.LUX.title}
        initialSessionId={thread.sessionId}
        initialMessages={thread.messages}
      />
    </div>
  );
}
