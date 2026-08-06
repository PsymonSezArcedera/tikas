import { z } from "zod";

import { emptyToUndefined, optionalPastDate } from "./shared";

/**
 * Weight log entry. Weight is metric (kg); bodyFat is a percentage. `date`
 * defaults to now in the Server Action when omitted.
 */
export const weightLogSchema = z.object({
  weight: z.coerce.number().positive().max(1000), // kg
  bodyFat: emptyToUndefined(z.coerce.number().min(0).max(100).optional()), // %
  date: optionalPastDate,
});

export type WeightLogInput = z.infer<typeof weightLogSchema>;
