import { GEMINI_MODEL, getGemini } from "./gemini";
import { COACHES, type CoachId } from "./coaches";
import { LOG_FOOD_TOOL } from "./food-tool";

export type ChatTurn = { role: "USER" | "ASSISTANT"; content: string };

// Map our stored messages to Gemini's content format (USER -> user, ASSISTANT
// -> model). The caller passes the full history including the latest user turn.
function toGeminiContents(turns: ChatTurn[]) {
  return turns.map((t) => ({
    role: t.role === "USER" ? "user" : "model",
    parts: [{ text: t.content }],
  }));
}

/**
 * Start a streaming reply from the given coach. Returns Gemini's async chunk
 * stream; each chunk exposes `.text`. Throws on request failure — the caller
 * turns that into a graceful error.
 */
export async function streamCoachReply(coachId: CoachId, turns: ChatTurn[]) {
  const ai = getGemini();
  return ai.models.generateContentStream({
    model: GEMINI_MODEL,
    contents: toGeminiContents(turns),
    config: {
      systemInstruction: COACHES[coachId].systemPrompt,
      temperature: 0.8,
    },
  });
}

/**
 * Vita's reply with the logFood tool available. Non-streaming: we need the whole
 * response to know whether it's a text reply or a function call before choosing
 * the response shape. Returns Gemini's response — read `.functionCalls` and
 * `.text`. Throws on request failure.
 */
export async function generateVitaReply(turns: ChatTurn[]) {
  const ai = getGemini();
  return ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: toGeminiContents(turns),
    config: {
      systemInstruction: COACHES.VITA.systemPrompt,
      temperature: 0.7,
      tools: [LOG_FOOD_TOOL],
    },
  });
}
