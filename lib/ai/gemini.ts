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

export const GEMINI_MODEL = "gemini-2.5-flash";
