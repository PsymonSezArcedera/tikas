import { prisma } from "./db";
import type { CoachId } from "./ai/coaches";

export type InitialThread = {
  sessionId: string | null;
  messages: { id: string; role: "USER" | "ASSISTANT"; content: string }[];
};

// The most recent conversation with a given coach, so reopening its page
// restores the thread. One rolling session per coach for now.
export async function getLatestCoachThread(
  userId: string,
  coach: CoachId,
): Promise<InitialThread> {
  const session = await prisma.chatSession.findFirst({
    where: { userId, coachType: coach },
    orderBy: { createdAt: "desc" },
    include: { messages: { orderBy: { timestamp: "asc" } } },
  });

  return {
    sessionId: session?.id ?? null,
    messages:
      session?.messages.map((m) => ({
        id: m.id,
        role: m.role,
        content: m.message,
      })) ?? [],
  };
}
