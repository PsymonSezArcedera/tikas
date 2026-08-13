import { NextRequest } from "next/server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  generateVitaReply,
  streamCoachReply,
  type ChatTurn,
} from "@/lib/ai/chat";
import { LOG_FOOD_NAME } from "@/lib/ai/food-tool";
import { nutritionSummary, SOURCE_LABEL } from "@/lib/food-summary";
import { resolveFoodNutrition } from "@/lib/off";
import { isMedicalConcern, MEDICAL_DECLINE } from "@/lib/ai/medical-guardrail";
import { chatRequestSchema, foodLogSchema } from "@/lib/validations";

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

// Vita's replies come back non-streamed (we need the whole thing to detect a
// tool call). Replay the text word-by-word so the client still reveals it like a
// stream.
function replayStream(text: string): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const parts = text.match(/\S+\s*/g) ?? [text];
  return new ReadableStream({
    async start(controller) {
      for (const part of parts) {
        controller.enqueue(encoder.encode(part));
        await new Promise((r) => setTimeout(r, 12));
      }
      controller.close();
    },
  });
}

async function saveAssistant(sessionId: string, message: string) {
  await prisma.chatMessage.create({
    data: { sessionId, role: "ASSISTANT", message },
  });
}

// Vita path: tool-enabled. Either proposes a food log (function call, validated,
// returned for the user to confirm) or replies with text. Nothing is written to
// the food diary here — the client confirms and routes through the food-logging
// Server Action.
async function handleVita(
  sessionId: string,
  turns: ChatTurn[],
): Promise<Response> {
  let result: Awaited<ReturnType<typeof generateVitaReply>>;
  try {
    result = await generateVitaReply(turns);
  } catch (err) {
    console.error("[coach] Vita request failed:", err);
    return new Response(
      "The coach is unavailable right now. Please try again in a moment.",
      { status: 502, headers: streamHeaders(sessionId) },
    );
  }

  const call = result.functionCalls?.find((c) => c.name === LOG_FOOD_NAME);
  if (call) {
    // GUARDRAIL: function-call args are untrusted model output — validate before
    // they can ever reach the database.
    const a = (call.args ?? {}) as Record<string, unknown>;
    const parsed = foodLogSchema.safeParse({
      mealType: a.mealType,
      foodName: a.foodName,
      quantity: a.quantity,
      servingSize: a.servingSize,
      servingUnit: a.servingUnit,
      calories: a.calories,
      protein: a.protein,
      carbs: a.carbs,
      fat: a.fat,
    });

    if (!parsed.success) {
      const say =
        "I couldn't put together a valid entry from that — tell me the food and roughly how much, and I'll try again.";
      await saveAssistant(sessionId, say);
      return new Response(stringStream(say), {
        headers: { ...streamHeaders(sessionId), "X-Coach-Response": "text" },
      });
    }

    const d = parsed.data;

    // Prefer real, sourced numbers from Open Food Facts over the model's guess.
    // We can only honestly scale OFF's per-100g data when the serving is a mass
    // or volume (g / ml); for "1 cup", "2 pieces", etc. the gram weight is
    // unknown, so we keep Vita's estimate. A miss (no relevant product, or OFF
    // down) also falls through to the estimate — the log is never blocked.
    let calories = d.calories;
    let protein = d.protein;
    let carbs = d.carbs;
    let fat = d.fat;
    let source: "estimate" | "off" = "estimate";

    const unit = d.servingUnit.trim().toLowerCase();
    const grams = unit === "g" || unit === "ml" ? d.quantity * d.servingSize : null;
    if (grams && grams > 0) {
      const resolved = await resolveFoodNutrition(d.foodName, grams);
      if (resolved) {
        calories = resolved.calories;
        protein = resolved.protein;
        carbs = resolved.carbs;
        fat = resolved.fat;
        source = "off";
      }
    }

    const facts = { foodName: d.foodName, calories, protein, carbs, fat };
    const proposal = {
      foodName: d.foodName,
      mealType: d.mealType,
      quantity: d.quantity,
      servingSize: d.servingSize,
      servingUnit: d.servingUnit,
      calories,
      protein,
      carbs,
      fat,
      source,
    };
    // Vita says the nutrition conversationally, then the card renders below with
    // just the editable fields. Built from the same (possibly OFF-sourced)
    // values, so prose and card match.
    const say = `${nutritionSummary(facts)} Here's what I'll log — check the numbers and confirm, or tweak them first.`;
    const sourceLabel = SOURCE_LABEL[proposal.source];
    // Persist the same words the bubble shows, including the source line, so
    // reopening the session reads identically (the confirm card is session-only).
    await saveAssistant(sessionId, `${say}\n\n${sourceLabel}`);

    return Response.json(
      { say, proposal },
      {
        headers: {
          "X-Session-Id": sessionId,
          "X-Coach-Response": "proposal",
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const text =
    result.text?.trim() ||
    "I'm not sure how to help with that — could you rephrase?";
  await saveAssistant(sessionId, text);
  return new Response(replayStream(text), {
    headers: { ...streamHeaders(sessionId), "X-Coach-Response": "text" },
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

  // Vita is agentic (logFood tool) — handled on its own path.
  if (coach === "VITA") {
    return handleVita(chatSessionId, turns);
  }

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
