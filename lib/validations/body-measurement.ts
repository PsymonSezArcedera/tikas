import { z } from "zod";

import { emptyToUndefined, optionalPastDate } from "./shared";

/**
 * Body measurement entry. All measurements are metric (cm) and individually
 * optional, but at least one must be provided. `date` defaults to now in the
 * Server Action when omitted.
 */
export const bodyMeasurementSchema = z
  .object({
    waist: emptyToUndefined(z.coerce.number().positive().max(500).optional()), // cm
    chest: emptyToUndefined(z.coerce.number().positive().max(500).optional()), // cm
    leftArm: emptyToUndefined(z.coerce.number().positive().max(500).optional()), // cm
    rightArm: emptyToUndefined(
      z.coerce.number().positive().max(500).optional(),
    ), // cm
    date: optionalPastDate,
  })
  .refine(
    (d) =>
      d.waist !== undefined ||
      d.chest !== undefined ||
      d.leftArm !== undefined ||
      d.rightArm !== undefined,
    { message: "Enter at least one measurement", path: ["waist"] },
  );

export type BodyMeasurementInput = z.infer<typeof bodyMeasurementSchema>;
