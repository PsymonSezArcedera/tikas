import { z } from "zod";

import { emptyToUndefined } from "./shared";

// Enum values mirror the Prisma enums (kept as plain z.enum so these schemas
// stay decoupled from the generated client and usable for AI-output parsing).
export const unitPreferenceEnum = z.enum(["METRIC", "IMPERIAL"]);
export const genderEnum = z.enum(["MALE", "FEMALE", "OTHER"]);
export const activityLevelEnum = z.enum([
  "SEDENTARY",
  "LIGHT",
  "MODERATE",
  "ACTIVE",
  "VERY_ACTIVE",
]);

/**
 * Profile update input. Measurements are metric (cm, kg) — the UI converts
 * to/from the user's unit before values reach this schema, since everything is
 * stored in metric. Auth fields (email, password) are handled by Better Auth,
 * not here. All profile fields are optional to allow partial updates.
 */
export const userProfileSchema = z.object({
  name: emptyToUndefined(z.string().trim().min(1).max(100).optional()),
  height: emptyToUndefined(z.coerce.number().positive().max(300).optional()), // cm
  weight: emptyToUndefined(z.coerce.number().positive().max(1000).optional()), // kg
  goalWeight: emptyToUndefined(
    z.coerce.number().positive().max(1000).optional(),
  ), // kg
  birthday: emptyToUndefined(
    z.coerce
      .date()
      .refine((d) => d <= new Date(), "Birthday must be in the past")
      .optional(),
  ),
  gender: genderEnum.optional(),
  activityLevel: activityLevelEnum.optional(),
  unitPreference: unitPreferenceEnum.default("METRIC"),
});

export type UserProfileInput = z.infer<typeof userProfileSchema>;
