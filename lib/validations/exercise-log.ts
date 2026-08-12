import { z } from "zod";

import { optionalPastDate } from "./shared";

/**
 * A recorded lift against a plan exercise. Weight is metric (kg) — the Server
 * Action converts from the user's unit before validating. `date` defaults to the
 * selected day in the action when omitted. The exercise name/link come from the
 * plan exercise, not the user, so they aren't part of this input schema.
 */
export const exerciseLogSchema = z.object({
  weight: z.coerce.number().positive().max(2000), // kg
  reps: z.coerce.number().int().min(1).max(1000),
  date: optionalPastDate,
});

export type ExerciseLogInput = z.infer<typeof exerciseLogSchema>;
