"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { displayToCm, displayToKg, type Unit } from "@/lib/units";
import { bodyMeasurementSchema, weightLogSchema } from "@/lib/validations";

// DTOs are plain/serializable (dates as ISO strings) so they cross the Server
// Action boundary and slot straight into the TanStack Query cache.
export type WeightLogDTO = {
  id: string;
  weight: number; // kg (metric — client converts for display)
  bodyFat: number | null;
  date: string; // ISO
};

export type BodyMeasurementDTO = {
  id: string;
  waist: number | null;
  chest: number | null;
  leftArm: number | null;
  rightArm: number | null;
  date: string; // ISO
};

export type ActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

export type WeightLogInputRaw = {
  weight: string; // in the user's unit
  bodyFat?: string;
  date?: string; // yyyy-mm-dd
};

export type BodyMeasurementInputRaw = {
  waist?: string;
  chest?: string;
  leftArm?: string;
  rightArm?: string;
  date?: string; // yyyy-mm-dd
};

async function requireUser() {
  const session = await getSession();
  if (!session) throw new Error("Not authenticated");
  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, unitPreference: true },
  });
  if (!user) throw new Error("Not authenticated");
  return user;
}

// Streaks read from DailyActivity, so mark the entry's day as "logged weight".
// We normalise to a UTC day to match the @db.Date column and the unique key.
function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

const firstIssue = (e: { issues: { message: string }[] }) =>
  e.issues[0]?.message ?? "Please check your entries.";

export async function getWeightLogs(): Promise<WeightLogDTO[]> {
  const user = await requireUser();
  const rows = await prisma.weightLog.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
    take: 10,
  });
  return rows.map((r) => ({
    id: r.id,
    weight: r.weight,
    bodyFat: r.bodyFat,
    date: r.date.toISOString(),
  }));
}

export async function getBodyMeasurements(): Promise<BodyMeasurementDTO[]> {
  const user = await requireUser();
  const rows = await prisma.bodyMeasurement.findMany({
    where: { userId: user.id },
    orderBy: { date: "desc" },
    take: 10,
  });
  return rows.map((r) => ({
    id: r.id,
    waist: r.waist,
    chest: r.chest,
    leftArm: r.leftArm,
    rightArm: r.rightArm,
    date: r.date.toISOString(),
  }));
}

export async function createWeightLog(
  input: WeightLogInputRaw,
): Promise<ActionResult<WeightLogDTO>> {
  const user = await requireUser();
  const unit = user.unitPreference as Unit;

  const rawWeight = input.weight?.trim();
  const weightNum = rawWeight ? Number(rawWeight) : NaN;

  const parsed = weightLogSchema.safeParse({
    // Convert the typed value from the user's unit to kg before validation.
    weight: Number.isFinite(weightNum) ? displayToKg(weightNum, unit) : rawWeight,
    bodyFat: input.bodyFat,
    date: input.date,
  });

  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const date = parsed.data.date ?? new Date();

  const created = await prisma.weightLog.create({
    data: {
      userId: user.id,
      weight: parsed.data.weight,
      bodyFat: parsed.data.bodyFat ?? null,
      date,
    },
  });

  // Flip today's (the entry's day's) streak flag.
  const activityDate = startOfUtcDay(date);
  await prisma.dailyActivity.upsert({
    where: { userId_date: { userId: user.id, date: activityDate } },
    create: { userId: user.id, date: activityDate, loggedWeight: true },
    update: { loggedWeight: true },
  });

  return {
    ok: true,
    data: {
      id: created.id,
      weight: created.weight,
      bodyFat: created.bodyFat,
      date: created.date.toISOString(),
    },
  };
}

export async function createBodyMeasurement(
  input: BodyMeasurementInputRaw,
): Promise<ActionResult<BodyMeasurementDTO>> {
  const user = await requireUser();
  const unit = user.unitPreference as Unit;

  // Convert each provided length from the user's unit to cm before validation.
  const toCm = (v?: string) => {
    const s = v?.trim();
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? displayToCm(n, unit) : s;
  };

  const parsed = bodyMeasurementSchema.safeParse({
    waist: toCm(input.waist),
    chest: toCm(input.chest),
    leftArm: toCm(input.leftArm),
    rightArm: toCm(input.rightArm),
    date: input.date,
  });

  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const created = await prisma.bodyMeasurement.create({
    data: {
      userId: user.id,
      waist: parsed.data.waist ?? null,
      chest: parsed.data.chest ?? null,
      leftArm: parsed.data.leftArm ?? null,
      rightArm: parsed.data.rightArm ?? null,
      date: parsed.data.date ?? new Date(),
    },
  });

  return {
    ok: true,
    data: {
      id: created.id,
      waist: created.waist,
      chest: created.chest,
      leftArm: created.leftArm,
      rightArm: created.rightArm,
      date: created.date.toISOString(),
    },
  };
}
