import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { streamCoachReply, type ChatTurn } from "@/lib/ai/chat";
import { isMedicalConcern, MEDICAL_DECLINE } from "@/lib/ai/medical-guardrail";
import { chatRequestSchema } from "@/lib/validations";

// Uses the Neon driver adapter (WebSocket) + Gemini, so this must run on Node.
export const runtime = "nodejs";
export const maxDuration = 60;

const streamHeaders = (sessionId: string) => ({
  "Content-Type": "text/plain; charset=utf-8",
  "Cache-Control": "no-cache, no-transform",
  "X-Accel-Buffering": "no", // don't let a proxy buffer the stream
  "X-Session-Id": sessionId,
});

// A ready-made string streamed back through the same channel as a model reply,
// so the client handles the guardrail case identically.
function stringStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  return new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return new Response("Please sign in again.", { status: 401 });
  }
  const userId = session.user.id;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return new Response("Invalid request.", { status: 400 });
  }

  const parsed = chatRequestSchema.safeParse(body);
  if (!parsed.success) {
    return new Response(
      parsed.error.issues[0]?.message ?? "Invalid request.",
      { status: 400 },
    );
  }
  const { coach, message, sessionId } = parsed.data;

  // Resolve the session (owned by this user, matching this coach) or start one.
  let chatSessionId: string;
  if (sessionId) {
    const existing = await prisma.chatSession.findFirst({
      where: { id: sessionId, userId, coachType: coach },
      select: { id: true },
    });
    if (!existing) {
      return new Response("Chat session not found.", { status: 404 });
    }
    chatSessionId = existing.id;
  } else {
    const created = await prisma.chatSession.create({
      data: {
        userId,
        coachType: coach,
        title: message.slice(0, 60),
      },
      select: { id: true },
    });
    chatSessionId = created.id;
  }

  // Persist the user's message up front so it survives a failed stream.
  await prisma.chatMessage.create({
    data: { sessionId: chatSessionId, role: "USER", message },
  });

  // The enforced guardrail: screen BEFORE the model. On a hit, decline + refer,
  // persist the reply, and never call Gemini.
  if (isMedicalConcern(message)) {
    await prisma.chatMessage.create({
      data: { sessionId: chatSessionId, role: "ASSISTANT", message: MEDICAL_DECLINE },
    });
    return new Response(stringStream(MEDICAL_DECLINE), {
      headers: streamHeaders(chatSessionId),
    });
  }

  // Full history (now includes the just-saved user turn as the last item).
  const history = await prisma.chatMessage.findMany({
    where: { sessionId: chatSessionId },
    orderBy: { timestamp: "asc" },
    select: { role: true, message: true },
  });
  const turns: ChatTurn[] = history.map((m) => ({
    role: m.role,
    content: m.message,
  }));

  let geminiStream: Awaited<ReturnType<typeof streamCoachReply>>;
  try {
    geminiStream = await streamCoachReply(coach, turns);
  } catch (err) {
    console.error("[coach] Gemini request failed:", err);
    return new Response(
      "The coach is unavailable right now. Please try again in a moment.",
      { status: 502, headers: streamHeaders(chatSessionId) },
    );
  }

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let full = "";
      try {
        for await (const chunk of geminiStream) {
          const text = chunk.text;
          if (text) {
            full += text;
            controller.enqueue(encoder.encode(text));
          }
        }
      } catch (err) {
        console.error("[coach] stream interrupted:", err);
        controller.enqueue(
          encoder.encode(
            "\n\n_(The connection was interrupted — please try again.)_",
          ),
        );
      } finally {
        controller.close();
        // Persist whatever the model produced (partial included) so reopening
        // the session shows the reply.
        if (full.trim()) {
          try {
            await prisma.chatMessage.create({
              data: { sessionId: chatSessionId, role: "ASSISTANT", message: full },
            });
          } catch (err) {
            console.error("[coach] failed to persist assistant message:", err);
          }
        }
      }
    },
  });

  return new Response(stream, { headers: streamHeaders(chatSessionId) });
}
