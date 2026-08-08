import { z } from "zod";

// Boundary validation for the chat Route Handler.
export const coachTypeEnum = z.enum(["FORTIS", "VITA", "LUX"]);

export const chatRequestSchema = z.object({
  coach: coachTypeEnum,
  message: z.string().trim().min(1, "Message is empty").max(4000),
  // Absent (or null) on the first turn of a new conversation.
  sessionId: z.string().trim().min(1).nullish(),
});

export type ChatRequest = z.infer<typeof chatRequestSchema>;
