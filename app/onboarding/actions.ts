"use server";

import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { userProfileSchema } from "@/lib/validations";

export type OnboardingState = { error?: string };

// Everything is stored in metric (kg, cm). Imperial inputs are converted here,
// before validation, so the DB only ever sees metric — the unitPreference we
// save lets the rest of the app convert back for display.
const LB_TO_KG = 0.45359237;
const IN_PER_FT = 12;
const CM_PER_IN = 2.54;

function toNumber(v: FormDataEntryValue | null): number | undefined {
  if (v == null) return undefined;
  const s = String(v).trim();
  if (s === "") return undefined;
  const n = Number(s);
  return Number.isFinite(n) ? n : undefined;
}

const round1 = (n: number) => Math.round(n * 10) / 10;

export async function saveProfile(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const session = await getSession();
  if (!session) redirect("/sign-in");

  const unit = String(formData.get("unitPreference") ?? "METRIC");
  const imperial = unit === "IMPERIAL";

  let heightCm: number | undefined;
  let weightKg: number | undefined;
  let goalKg: number | undefined;

  if (imperial) {
    const ft = toNumber(formData.get("heightFt"));
    const inch = toNumber(formData.get("heightIn"));
    if (ft != null || inch != null) {
      heightCm = round1(((ft ?? 0) * IN_PER_FT + (inch ?? 0)) * CM_PER_IN);
    }
    const w = toNumber(formData.get("weight"));
    if (w != null) weightKg = round1(w * LB_TO_KG);
    const g = toNumber(formData.get("goalWeight"));
    if (g != null) goalKg = round1(g * LB_TO_KG);
  } else {
    heightCm = toNumber(formData.get("heightCm"));
    weightKg = toNumber(formData.get("weight"));
    goalKg = toNumber(formData.get("goalWeight"));
  }

  const parsed = userProfileSchema.safeParse({
    height: heightCm,
    weight: weightKg,
    goalWeight: goalKg,
    birthday: formData.get("birthday"),
    gender: formData.get("gender") || undefined,
    activityLevel: formData.get("activityLevel") || undefined,
    unitPreference: unit,
  });

  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Please check your entries.",
    };
  }

  // Onboarding requires the full set — userProfileSchema allows partial updates,
  // so enforce completeness here before we let the user into the app.
  const d = parsed.data;
  if (
    d.height == null ||
    d.weight == null ||
    d.goalWeight == null ||
    d.birthday == null ||
    d.gender == null ||
    d.activityLevel == null
  ) {
    return { error: "Please fill in every field to finish setting up your profile." };
  }

  await prisma.user.update({
    where: { id: session.user.id },
    data: {
      height: d.height,
      weight: d.weight,
      goalWeight: d.goalWeight,
      birthday: d.birthday,
      gender: d.gender,
      activityLevel: d.activityLevel,
      unitPreference: d.unitPreference,
    },
  });

  redirect("/dashboard");
}
