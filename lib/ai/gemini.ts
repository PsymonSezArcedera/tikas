import { GoogleGenAI } from "@google/genai";

// Lazily created so a missing key doesn't crash the build (or unrelated pages) —
// it only errors when we actually try to call the model, where the caller can
// turn it into a friendly message. The key comes from the environment; never
// hardcode it.
let client: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (client) return client;
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  client = new GoogleGenAI({ apiKey });
  return client;
}

// Single source of truth for the model — shared by the coaches (lib/ai/chat.ts)
// and the workout generator (lib/ai/workout.ts). Swap this one line to change
// models everywhere.
//
// Pinned to a specific Flash-Lite version (not the auto-updating
// `gemini-flash-lite-latest` alias) so coach and workout output stays
// reproducible until a deliberate version bump. Flash-Lite has its own separate,
// much higher free-tier daily quota than 2.5-flash's 20/day (confirmed via a
// real 429). Note: `gemini-2.5-flash-lite` is 404-gated for this key ("no longer
// available to new users") and `gemini-2.0-flash{,-lite}` were quota-exhausted,
// so 3.5-flash-lite is the pinned, working, high-cap choice.
export const GEMINI_MODEL = "gemini-3.5-flash-lite";
