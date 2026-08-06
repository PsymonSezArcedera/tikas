import { z } from "zod";

// Internal helpers shared across the validation schemas. Not part of the public
// re-export surface in index.ts — import from here directly if needed.

/**
 * Treat empty string / null as "not provided". HTML form fields submit `""`
 * for blank inputs; this maps that to `undefined` so `.optional()` fields don't
 * fail (or, for coerced numbers, silently become `0`). Wrap an already-optional
 * schema: `emptyToUndefined(z.coerce.number().positive().optional())`.
 */
export const emptyToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((v) => (v === "" || v === null ? undefined : v), schema);

/**
 * An optional date that accepts Date objects or parseable strings (ISO from
 * JSON/AI output, or datetime-local form values) and rejects future dates.
 * Used for log entry timestamps — backdating is fine, the future is not.
 * The "now" comparison runs at parse time, not module load.
 */
export const optionalPastDate = emptyToUndefined(
  z.coerce
    .date()
    .refine((d) => d <= new Date(), "Date cannot be in the future")
    .optional(),
);
