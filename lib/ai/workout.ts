import { Type } from "@google/genai";

import type { WorkoutPlanRequest } from "@/lib/validations";
import { GEMINI_MODEL, getGemini } from "./gemini";

// Structured-output schema handed to Gemini. Mirrors aiWorkoutPlanSchema so the
// model returns JSON shaped like our Exercise model. `notes` is intentionally
// not required. (This constrains generation; the Zod parse afterwards is the
// enforced guardrail before anything is stored.)
const responseSchema = {
  type: Type.OBJECT,
  properties: {
    title: { type: Type.STRING },
    exercises: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          day: { type: Type.STRING },
          exercise: { type: Type.STRING },
          sets: { type: Type.INTEGER },
          reps: { type: Type.STRING },
          rest: { type: Type.STRING },
          notes: { type: Type.STRING },
        },
        required: ["day", "exercise", "sets", "reps", "rest"],
        propertyOrdering: ["day", "exercise", "sets", "reps", "rest", "notes"],
      },
    },
  },
  required: ["title", "exercises"],
  propertyOrdering: ["title", "exercises"],
};

const SYSTEM_INSTRUCTION = `You are Fortis, an experienced strength and conditioning coach.
Design safe, effective, progressive resistance-training plans tailored to the
user's goal, schedule, equipment, and experience-implied intensity. Prefer
compound movements, sensible volume, and clear progression. Only prescribe
exercises the user's available equipment allows. Keep each training day realistic
within the given session length. Respond with JSON only.`;

function buildPrompt(req: WorkoutPlanRequest): string {
  return [
    "Create a workout plan with these requirements:",
    `- Goal: ${req.goal}`,
    `- Training days per week: ${req.daysPerWeek}`,
    `- Time available per session: ${req.sessionMinutes} minutes`,
    `- Available equipment: ${req.equipment.join(", ")}`,
    `- Intensity: ${req.intensity}`,
    `- Target muscle groups: ${req.muscleGroups.join(", ")}`,
    "",
    "Rules:",
    `- Organise the exercises across exactly ${req.daysPerWeek} training day(s).`,
    '- Label each exercise\'s "day" clearly, e.g. "Day 1 — Push" or "Day 2 — Lower".',
    `- Keep each day completable within ${req.sessionMinutes} minutes.`,
    "- Use only the available equipment listed above.",
    '- "sets" is an integer; "reps" is a string like "8-12" or "30s"; "rest" is a string like "90s".',
    "- Add a short, useful note (form cue or tempo) where helpful.",
    "- Give the plan a short, motivating title.",
  ].join("\n");
}

/**
 * Calls Gemini and returns the raw JSON text. Throws on API/network failure or
 * an empty response. Parsing + validation happen at the Server Action boundary.
 */
export async function generateWorkoutPlanJSON(
  req: WorkoutPlanRequest,
): Promise<string> {
  const ai = getGemini();
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: buildPrompt(req),
    config: {
      systemInstruction: SYSTEM_INSTRUCTION,
      responseMimeType: "application/json",
      responseSchema,
      temperature: 0.7,
    },
  });

  const text = response.text;
  if (!text || !text.trim()) {
    throw new Error("Empty response from Gemini");
  }
  return text;
}
