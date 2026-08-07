import { z } from "zod";

// Form-input option lists — shared by the form and the request schema so they
// can't drift.
export const WORKOUT_GOALS = [
  "Build muscle",
  "Lose fat",
  "Get stronger",
  "General fitness",
  "Improve endurance",
] as const;

export const INTENSITIES = ["Low", "Moderate", "High"] as const;

export const EQUIPMENT_OPTIONS = [
  "Bodyweight",
  "Dumbbells",
  "Barbell",
  "Kettlebell",
  "Resistance bands",
  "Machines",
  "Pull-up bar",
  "Bench",
] as const;

export const FOCUS_OPTIONS = [
  "Full body",
  "Chest",
  "Back",
  "Shoulders",
  "Arms",
  "Legs",
  "Core",
  "Glutes",
] as const;

/** Plan generation request (the form inputs). Validated before hitting Gemini. */
export const workoutPlanRequestSchema = z.object({
  goal: z.enum(WORKOUT_GOALS),
  intensity: z.enum(INTENSITIES),
  daysPerWeek: z.coerce.number().int().min(1).max(7),
  sessionMinutes: z.coerce.number().int().min(15).max(180),
  equipment: z
    .array(z.string().trim().min(1))
    .min(1, "Pick at least one equipment option")
    .max(20),
  muscleGroups: z
    .array(z.string().trim().min(1))
    .min(1, "Pick at least one focus area")
    .max(20),
});

export type WorkoutPlanRequest = z.infer<typeof workoutPlanRequestSchema>;

/**
 * The critical guardrail: the shape we require Gemini's JSON to have before ANY
 * of it reaches Prisma. Maps 1:1 to the Exercise model (day, exercise, sets,
 * reps, rest, notes) grouped under a plan title. Gemini's structured output
 * makes valid JSON likely, but this parse is what's actually enforced — never
 * write unvalidated AI output to the database.
 */
export const aiExerciseSchema = z.object({
  day: z.string().trim().min(1).max(80),
  exercise: z.string().trim().min(1).max(120),
  sets: z.coerce.number().int().min(1).max(30),
  reps: z.string().trim().min(1).max(40),
  rest: z.string().trim().min(1).max(40),
  notes: z
    .string()
    .max(300)
    .nullish()
    .transform((v) => {
      const t = v?.trim();
      return t ? t : null;
    }),
});

export const aiWorkoutPlanSchema = z.object({
  title: z.string().trim().min(1).max(120),
  exercises: z.array(aiExerciseSchema).min(1).max(80),
});

export type AiWorkoutPlan = z.infer<typeof aiWorkoutPlanSchema>;
