"use server";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import {
  markDailyActivity,
  reevaluateLoggedWeight,
} from "@/lib/daily-activity";
import { addDays, dayInstant, dayStart, safeDayKey, todayKey } from "@/lib/day";
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

const firstIssue = (e: { issues: { message: string }[] }) =>
  e.issues[0]?.message ?? "Please check your entries.";

const toWeightDTO = (r: {
  id: string;
  weight: number;
  bodyFat: number | null;
  date: Date;
}): WeightLogDTO => ({
  id: r.id,
  weight: r.weight,
  bodyFat: r.bodyFat,
  date: r.date.toISOString(),
});

const toBodyDTO = (r: {
  id: string;
  waist: number | null;
  chest: number | null;
  leftArm: number | null;
  rightArm: number | null;
  date: Date;
}): BodyMeasurementDTO => ({
  id: r.id,
  waist: r.waist,
  chest: r.chest,
  leftArm: r.leftArm,
  rightArm: r.rightArm,
  date: r.date.toISOString(),
});

/** The UTC instant range [start, end) covering the given app-day (UTC+8). */
function dayRange(key: string) {
  const day = safeDayKey(key);
  return { gte: dayStart(day), lt: dayStart(addDays(day, 1)) };
}

/** Weight logs for one app-day (UTC+8), matching how DailyActivity buckets. */
export async function getWeightLogsForDay(key: string): Promise<WeightLogDTO[]> {
  const user = await requireUser();
  const rows = await prisma.weightLog.findMany({
    where: { userId: user.id, date: dayRange(key) },
    orderBy: { date: "desc" },
  });
  return rows.map(toWeightDTO);
}

/** Body measurements for one app-day (UTC+8). */
export async function getBodyMeasurementsForDay(
  key: string,
): Promise<BodyMeasurementDTO[]> {
  const user = await requireUser();
  const rows = await prisma.bodyMeasurement.findMany({
    where: { userId: user.id, date: dayRange(key) },
    orderBy: { date: "desc" },
  });
  return rows.map(toBodyDTO);
}

// Parse + unit-convert a raw weight form into validated kg/bodyFat. Shared by
// create and update so both apply the same conversion and rules.
function parseWeight(input: WeightLogInputRaw, unit: Unit) {
  const rawWeight = input.weight?.trim();
  const weightNum = rawWeight ? Number(rawWeight) : NaN;
  return weightLogSchema.safeParse({
    // Convert the typed value from the user's unit to kg before validation.
    weight: Number.isFinite(weightNum) ? displayToKg(weightNum, unit) : rawWeight,
    bodyFat: input.bodyFat,
    date: input.date,
  });
}

/**
 * Create a weigh-in on `dayKey` (defaults to today). The entry is dated to that
 * app-day so it shows under the right date and DailyActivity.loggedWeight flips
 * for that day — this is what lets a user back-fill a past day.
 */
export async function createWeightLog(
  input: WeightLogInputRaw,
  dayKey: string = todayKey(),
): Promise<ActionResult<WeightLogDTO>> {
  const user = await requireUser();
  const parsed = parseWeight(input, user.unitPreference as Unit);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const date = parsed.data.date ?? dayInstant(safeDayKey(dayKey));

  const created = await prisma.weightLog.create({
    data: {
      userId: user.id,
      weight: parsed.data.weight,
      bodyFat: parsed.data.bodyFat ?? null,
      date,
    },
  });

  // Flip the entry's day's streak flag.
  await markDailyActivity(user.id, date, { loggedWeight: true });

  return { ok: true, data: toWeightDTO(created) };
}

/**
 * Edit a weigh-in. Re-validated with the same schema/conversion as create; the
 * row's date is preserved, so its day bucket is unchanged and loggedWeight needs
 * no re-evaluation (there's still ≥1 weigh-in that day). Ownership-checked.
 */
export async function updateWeightLog(
  id: string,
  input: WeightLogInputRaw,
): Promise<ActionResult<WeightLogDTO>> {
  const user = await requireUser();
  const parsed = parseWeight(input, user.unitPreference as Unit);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const existing = await prisma.weightLog.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false, error: "That entry no longer exists." };
  }

  const updated = await prisma.weightLog.update({
    where: { id },
    data: {
      weight: parsed.data.weight,
      bodyFat: parsed.data.bodyFat ?? null,
      // date intentionally unchanged — keep the entry on its original day.
    },
  });

  return { ok: true, data: toWeightDTO(updated) };
}

/**
 * Delete a weigh-in (ownership-checked). Afterwards re-evaluate the day's
 * loggedWeight: if that was the last weigh-in for the day, it flips back to
 * false so the streak stays accurate.
 */
export async function deleteWeightLog(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const existing = await prisma.weightLog.findFirst({
    where: { id, userId: user.id },
    select: { id: true, date: true },
  });
  if (!existing) {
    return { ok: false, error: "That entry no longer exists." };
  }

  await prisma.weightLog.delete({ where: { id } });
  await reevaluateLoggedWeight(user.id, existing.date);

  return { ok: true, data: { id } };
}

// Parse + unit-convert a raw measurement form into validated cm fields. Shared
// by create and update. Body measurements don't touch DailyActivity.
function parseBody(input: BodyMeasurementInputRaw, unit: Unit) {
  // Convert each provided length from the user's unit to cm before validation.
  const toCm = (v?: string) => {
    const s = v?.trim();
    if (!s) return undefined;
    const n = Number(s);
    return Number.isFinite(n) ? displayToCm(n, unit) : s;
  };

  return bodyMeasurementSchema.safeParse({
    waist: toCm(input.waist),
    chest: toCm(input.chest),
    leftArm: toCm(input.leftArm),
    rightArm: toCm(input.rightArm),
    date: input.date,
  });
}

/** Create a measurement on `dayKey` (defaults to today) — back-fills a past day. */
export async function createBodyMeasurement(
  input: BodyMeasurementInputRaw,
  dayKey: string = todayKey(),
): Promise<ActionResult<BodyMeasurementDTO>> {
  const user = await requireUser();
  const parsed = parseBody(input, user.unitPreference as Unit);
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
      date: parsed.data.date ?? dayInstant(safeDayKey(dayKey)),
    },
  });

  return { ok: true, data: toBodyDTO(created) };
}

/** Edit a measurement (ownership-checked; date preserved). */
export async function updateBodyMeasurement(
  id: string,
  input: BodyMeasurementInputRaw,
): Promise<ActionResult<BodyMeasurementDTO>> {
  const user = await requireUser();
  const parsed = parseBody(input, user.unitPreference as Unit);
  if (!parsed.success) {
    return { ok: false, error: firstIssue(parsed.error) };
  }

  const existing = await prisma.bodyMeasurement.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false, error: "That entry no longer exists." };
  }

  const updated = await prisma.bodyMeasurement.update({
    where: { id },
    data: {
      waist: parsed.data.waist ?? null,
      chest: parsed.data.chest ?? null,
      leftArm: parsed.data.leftArm ?? null,
      rightArm: parsed.data.rightArm ?? null,
      // date intentionally unchanged.
    },
  });

  return { ok: true, data: toBodyDTO(updated) };
}

/** Delete a measurement (ownership-checked). Does not touch DailyActivity —
 *  measurements don't drive the streak. */
export async function deleteBodyMeasurement(
  id: string,
): Promise<ActionResult<{ id: string }>> {
  const user = await requireUser();
  const existing = await prisma.bodyMeasurement.findFirst({
    where: { id, userId: user.id },
    select: { id: true },
  });
  if (!existing) {
    return { ok: false, error: "That entry no longer exists." };
  }

  await prisma.bodyMeasurement.delete({ where: { id } });
  return { ok: true, data: { id } };
}
