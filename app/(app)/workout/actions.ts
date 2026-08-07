"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { generateWorkoutPlanJSON } from "@/lib/ai/workout";
import { aiWorkoutPlanSchema, workoutPlanRequestSchema } from "@/lib/validations";

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

export async function getLatestPlan(): Promise<PlanDTO | null> {
  const session = await getSession();
  if (!session) return null;
  const plan = await prisma.workoutPlan.findFirst({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: { exercises: true },
  });
  return plan ? toPlanDTO(plan) : null;
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
      include: { exercises: true },
    });
    return { plan: toPlanDTO(created) };
  } catch (err) {
    console.error("[workout] Failed to store plan:", err);
    return { error: "Couldn't save the plan. Please try again." };
  }
}
