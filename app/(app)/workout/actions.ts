"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { markDailyActivity, reevaluateWorkedOut } from "@/lib/daily-activity";
import { dayInstant, safeDayKey, todayKey } from "@/lib/day";
import { displayToKg, type Unit } from "@/lib/units";
import { generateWorkoutPlanJSON } from "@/lib/ai/workout";
import {
  aiExerciseSchema,
  aiWorkoutPlanSchema,
  exerciseEditSchema,
  exerciseLogSchema,
  workoutPlanMetaSchema,
  workoutPlanRequestSchema,
} from "@/lib/validations";

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type ExerciseInputRaw = {
  exercise: string;
  sets: string;
  reps: string;
  rest: string;
  notes: string;
};
export type AddExerciseInputRaw = ExerciseInputRaw & { day: string };
export type PlanMetaInputRaw = {
  title: string;
  goal: string;
  intensity: string;
  duration: string;
};

export type ExerciseDTO = {
  id: string;
  day: string;
  exercise: string;
  sets: number;
  reps: string;
  rest: string;
  notes: string | null;
};

export type PlanDTO = {
  id: string;
  title: string;
  goal: string;
  intensity: string;
  days: number;
  duration: number;
  createdAt: string;
  exercises: ExerciseDTO[];
};

export type GenerateState = { error?: string; plan?: PlanDTO };

function toPlanDTO(plan: {
  id: string;
  title: string;
  goal: string;
  intensity: string;
  days: number;
  duration: number;
  createdAt: Date;
  exercises: {
    id: string;
    day: string;
    exercise: string;
    sets: number;
    reps: string;
    rest: string;
    notes: string | null;
  }[];
}): PlanDTO {
  return {
    id: plan.id,
    title: plan.title,
    goal: plan.goal,
    intensity: plan.intensity,
    days: plan.days,
    duration: plan.duration,
    createdAt: plan.createdAt.toISOString(),
    exercises: plan.exercises.map((e) => ({
      id: e.id,
      day: e.day,
      exercise: e.exercise,
      sets: e.sets,
      reps: e.reps,
      rest: e.rest,
      notes: e.notes,
    })),
  };
}

// Exercises are ordered by id: cuids are creation-ordered, so a plan's original
// exercises keep their generated order and newly added ones land after the
// existing ones within their day.
const withExercises = {
  exercises: { orderBy: { id: "asc" } },
} as const;

const firstIssue = (e: { issues: { message: string }[] }) =>
  e.issues[0]?.message ?? "Please check your entries.";

const toExerciseDTO = (e: {
  id: string;
  day: string;
  exercise: string;
  sets: number;
  reps: string;
  rest: string;
  notes: string | null;
}): ExerciseDTO => ({
  id: e.id,
  day: e.day,
  exercise: e.exercise,
  sets: e.sets,
  reps: e.reps,
  rest: e.rest,
  notes: e.notes,
});

async function requireUserId(): Promise<string> {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");
  return session.user.id;
}

export async function getLatestPlan(): Promise<PlanDTO | null> {
  const session = await getSession();
  if (!session) return null;
  const plan = await prisma.workoutPlan.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: withExercises,
  });
  return plan ? toPlanDTO(plan) : null;
}

/** Edit plan metadata (title, goal, intensity, duration). Ownership-checked. */
export async function updatePlanMeta(
  planId: string,
  input: PlanMetaInputRaw,
): Promise<ActionResult<PlanDTO>> {
  const userId = await requireUserId();

  const parsed = workoutPlanMetaSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const owned = await prisma.workoutPlan.findFirst({
    where: { id: planId, userId },
    select: { id: true },
  });
  if (!owned) return { ok: false, error: "That plan no longer exists." };

  const updated = await prisma.workoutPlan.update({
    where: { id: planId },
    data: {
      title: parsed.data.title,
      goal: parsed.data.goal,
      intensity: parsed.data.intensity,
      duration: parsed.data.duration,
      // updatedAt bumps automatically (@updatedAt).
    },
    include: withExercises,
  });
  return { ok: true, data: toPlanDTO(updated) };
}

/** Edit one exercise (name, sets, reps, rest, notes). Ownership via its plan. */
export async function updateExercise(
  id: string,
  input: ExerciseInputRaw,
): Promise<ActionResult<ExerciseDTO>> {
  const userId = await requireUserId();

  const parsed = exerciseEditSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const ex = await prisma.exercise.findFirst({
    where: { id, plan: { userId } },
    select: { id: true, planId: true },
  });
  if (!ex) return { ok: false, error: "That exercise no longer exists." };

  // Atomic: update the row and bump the parent plan's updatedAt together.
  const [updated] = await prisma.$transaction([
    prisma.exercise.update({
      where: { id },
      data: {
        exercise: parsed.data.exercise,
        sets: parsed.data.sets,
        reps: parsed.data.reps,
        rest: parsed.data.rest,
        notes: parsed.data.notes,
      },
    }),
    prisma.workoutPlan.update({
      where: { id: ex.planId },
      data: { updatedAt: new Date() },
    }),
  ]);
  return { ok: true, data: toExerciseDTO(updated) };
}

/** Add an exercise to a day of a plan. Ownership-checked. */
export async function addExercise(
  planId: string,
  input: AddExerciseInputRaw,
): Promise<ActionResult<ExerciseDTO>> {
  const userId = await requireUserId();

  const parsed = aiExerciseSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const owned = await prisma.workoutPlan.findFirst({
    where: { id: planId, userId },
    select: { id: true },
  });
  if (!owned) return { ok: false, error: "That plan no longer exists." };

  const [created] = await prisma.$transaction([
    prisma.exercise.create({
      data: {
        planId,
        day: parsed.data.day,
        exercise: parsed.data.exercise,
        sets: parsed.data.sets,
        reps: parsed.data.reps,
        rest: parsed.data.rest,
        notes: parsed.data.notes,
      },
    }),
    prisma.workoutPlan.update({
      where: { id: planId },
      data: { updatedAt: new Date() },
    }),
  ]);
  return { ok: true, data: toExerciseDTO(created) };
}

/** Delete one exercise. Ownership via its plan. */
export async function deleteExercise(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();

  const ex = await prisma.exercise.findFirst({
    where: { id, plan: { userId } },
    select: { id: true, planId: true },
  });
  if (!ex) return { ok: false, error: "That exercise no longer exists." };

  await prisma.$transaction([
    prisma.exercise.delete({ where: { id } }),
    prisma.workoutPlan.update({
      where: { id: ex.planId },
      data: { updatedAt: new Date() },
    }),
  ]);
  return { ok: true, data: { id } };
}

/**
 * Delete a whole day of exercises. Atomic: removes the day's exercises and
 * recomputes the plan's `days` count in one transaction, so the badge stays
 * accurate and the update bumps updatedAt.
 */
export async function deleteDay(
  planId: string,
  day: string,
): Promise<ActionResult<{ day: string }>> {
  const userId = await requireUserId();

  const owned = await prisma.workoutPlan.findFirst({
    where: { id: planId, userId },
    select: { id: true },
  });
  if (!owned) return { ok: false, error: "That plan no longer exists." };

  await prisma.$transaction(async (tx) => {
    await tx.exercise.deleteMany({ where: { planId, day } });
    const remaining = await tx.exercise.findMany({
      where: { planId },
      select: { day: true },
      distinct: ["day"],
    });
    await tx.workoutPlan.update({
      where: { id: planId },
      data: { days: remaining.length },
    });
  });
  return { ok: true, data: { day } };
}

/** Delete an entire plan (cascade removes its exercises). Ownership-checked. */
export async function deletePlan(
  planId: string,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();

  const owned = await prisma.workoutPlan.findFirst({
    where: { id: planId, userId },
    select: { id: true },
  });
  if (!owned) return { ok: false, error: "That plan no longer exists." };

  await prisma.workoutPlan.delete({ where: { id: planId } });
  return { ok: true, data: { id: planId } };
}

export async function generatePlan(
  _prev: GenerateState,
  formData: FormData,
): Promise<GenerateState> {
  const session = await getSession();
  if (!session) return { error: "Please sign in again." };

  // 1) Validate the form inputs before spending an API call.
  const parsedInput = workoutPlanRequestSchema.safeParse({
    goal: formData.get("goal"),
    intensity: formData.get("intensity"),
    daysPerWeek: formData.get("daysPerWeek"),
    sessionMinutes: formData.get("sessionMinutes"),
    equipment: formData.getAll("equipment"),
    muscleGroups: formData.getAll("muscleGroups"),
  });
  if (!parsedInput.success) {
    return {
      error: parsedInput.error.issues[0]?.message ?? "Please check your selections.",
    };
  }
  const req = parsedInput.data;

  // 2) Call Gemini. Network/API failure → friendly message, nothing written.
  let rawText: string;
  try {
    rawText = await generateWorkoutPlanJSON(req);
  } catch (err) {
    console.error("[workout] Gemini request failed:", err);
    return {
      error: "The coach couldn't generate a plan right now. Please try again in a moment.",
    };
  }

  // 3) Parse the JSON. Malformed text → friendly message, nothing written.
  let rawJson: unknown;
  try {
    rawJson = JSON.parse(rawText);
  } catch (err) {
    console.error("[workout] Gemini returned non-JSON:", err);
    return { error: "The generated plan came back unreadable. Please try again." };
  }

  // 4) THE GUARDRAIL: validate the AI output before it can touch the database.
  const parsedPlan = aiWorkoutPlanSchema.safeParse(rawJson);
  if (!parsedPlan.success) {
    console.error("[workout] AI output failed validation:", parsedPlan.error.issues);
    return {
      error: "The generated plan didn't match the expected format. Please try again.",
    };
  }

  // 5) Store atomically — plan + its exercises in one nested create, so a
  //    failure never leaves a half-written plan.
  try {
    const created = await prisma.workoutPlan.create({
      data: {
        userId: session.user.id,
        title: parsedPlan.data.title,
        goal: req.goal,
        intensity: req.intensity,
        days: req.daysPerWeek,
        duration: req.sessionMinutes,
        exercises: {
          create: parsedPlan.data.exercises.map((e) => ({
            day: e.day,
            exercise: e.exercise,
            sets: e.sets,
            reps: e.reps,
            rest: e.rest,
            notes: e.notes,
          })),
        },
      },
      include: withExercises,
    });
    return { plan: toPlanDTO(created) };
  } catch (err) {
    console.error("[workout] Failed to store plan:", err);
    return { error: "Couldn't save the plan. Please try again." };
  }
}

/* --------------------------- Lift logging (PRs) -------------------------- */

// A recorded lift. weight is metric (kg); the client converts for display. date
// is the ISO instant; PR/history/progression group by exerciseName (normalized
// client-side) across all plans and days.
export type LiftLogDTO = {
  id: string;
  exerciseId: string | null;
  exerciseName: string;
  weight: number; // kg
  reps: number;
  date: string; // ISO
};

export type LiftInputRaw = { weight: string; reps: string };

const toLiftDTO = (r: {
  id: string;
  exerciseId: string | null;
  exerciseName: string;
  weight: number;
  reps: number;
  date: Date;
}): LiftLogDTO => ({
  id: r.id,
  exerciseId: r.exerciseId,
  exerciseName: r.exerciseName,
  weight: r.weight,
  reps: r.reps,
  date: r.date.toISOString(),
});

/** All of the user's recorded lifts, oldest first (stable order for grouping
 *  and progression charts; PRs and history are derived client-side by name). */
export async function getLiftLogs(): Promise<LiftLogDTO[]> {
  const session = await getSession();
  if (!session) return [];
  const rows = await prisma.exerciseLog.findMany({
    where: { userId: session.user.id },
    orderBy: [{ date: "asc" }, { createdAt: "asc" }],
  });
  return rows.map(toLiftDTO);
}

/**
 * Record a lift against a plan exercise on `dayKey` (defaults to today). The log
 * is soft-linked to the plan exercise but stores its name denormalized, so PR
 * history survives the plan exercise being edited/deleted. Flips workedOut for
 * that calendar day. Ownership is checked via the exercise's plan.
 */
export async function logLift(
  exerciseId: string,
  input: LiftInputRaw,
  dayKey: string = todayKey(),
): Promise<ActionResult<LiftLogDTO>> {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { unitPreference: true },
  });
  const unit = (user?.unitPreference ?? "METRIC") as Unit;

  const rawWeight = input.weight?.trim();
  const weightNum = rawWeight ? Number(rawWeight) : NaN;
  const parsed = exerciseLogSchema.safeParse({
    // Convert the typed weight from the user's unit to kg before validation.
    weight: Number.isFinite(weightNum) ? displayToKg(weightNum, unit) : rawWeight,
    reps: input.reps,
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const exercise = await prisma.exercise.findFirst({
    where: { id: exerciseId, plan: { userId } },
    select: { id: true, exercise: true },
  });
  if (!exercise) return { ok: false, error: "That exercise no longer exists." };

  const date = parsed.data.date ?? dayInstant(safeDayKey(dayKey));

  const created = await prisma.exerciseLog.create({
    data: {
      userId,
      exerciseId: exercise.id,
      exerciseName: exercise.exercise.trim(),
      weight: parsed.data.weight,
      reps: parsed.data.reps,
      date,
    },
  });

  await markDailyActivity(userId, date, { workedOut: true });

  return { ok: true, data: toLiftDTO(created) };
}

/** Edit a recorded lift's weight/reps. Ownership-checked; date preserved. */
export async function updateLift(
  id: string,
  input: LiftInputRaw,
): Promise<ActionResult<LiftLogDTO>> {
  const userId = await requireUserId();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { unitPreference: true },
  });
  const unit = (user?.unitPreference ?? "METRIC") as Unit;

  const rawWeight = input.weight?.trim();
  const weightNum = rawWeight ? Number(rawWeight) : NaN;
  const parsed = exerciseLogSchema.safeParse({
    weight: Number.isFinite(weightNum) ? displayToKg(weightNum, unit) : rawWeight,
    reps: input.reps,
  });
  if (!parsed.success) return { ok: false, error: firstIssue(parsed.error) };

  const existing = await prisma.exerciseLog.findFirst({
    where: { id, userId },
    select: { id: true },
  });
  if (!existing) return { ok: false, error: "That entry no longer exists." };

  const updated = await prisma.exerciseLog.update({
    where: { id },
    data: { weight: parsed.data.weight, reps: parsed.data.reps },
  });
  return { ok: true, data: toLiftDTO(updated) };
}

/**
 * Delete a recorded lift (ownership-checked). Re-evaluates workedOut for that
 * calendar day: if it was the last lift of the day, the flag flips back to false.
 */
export async function deleteLift(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const userId = await requireUserId();
  const existing = await prisma.exerciseLog.findFirst({
    where: { id, userId },
    select: { id: true, date: true },
  });
  if (!existing) return { ok: false, error: "That entry no longer exists." };

  await prisma.exerciseLog.delete({ where: { id } });
  await reevaluateWorkedOut(userId, existing.date);

  return { ok: true, data: { id } };
}
