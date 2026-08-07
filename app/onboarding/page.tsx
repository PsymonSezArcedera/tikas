import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isProfileComplete } from "@/lib/profile";
import { OnboardingForm } from "./onboarding-form";

export const metadata: Metadata = { title: "Set up your profile" };

// Session-guarded like the app routes. A user who already has a complete profile
// is bounced to the dashboard so they can't sit on onboarding; everyone else
// fills the form. The (app) layout is what routes incomplete users *here*.
export default async function OnboardingPage() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: {
      name: true,
      height: true,
      weight: true,
      goalWeight: true,
      birthday: true,
      gender: true,
      activityLevel: true,
      unitPreference: true,
    },
  });

  if (isProfileComplete(user)) {
    redirect("/dashboard");
  }

  const firstName = user?.name?.trim().split(" ")[0];

  return (
    <div className="flex flex-col gap-6">
      <header className="text-center">
        <p className="text-xs font-medium uppercase tracking-wider text-primary">
          Step 1 of 1
        </p>
        <h1 className="mt-2 font-display text-3xl font-semibold tracking-tight">
          {firstName ? `Welcome, ${firstName}` : "Welcome to Tikas"}
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          A few details so we can tailor your dashboard, targets, and coaching.
        </p>
      </header>

      <OnboardingForm
        defaults={{
          unitPreference: user?.unitPreference ?? "METRIC",
          height: user?.height ?? null,
          weight: user?.weight ?? null,
          goalWeight: user?.goalWeight ?? null,
          birthday: user?.birthday
            ? user.birthday.toISOString().slice(0, 10)
            : "",
          gender: user?.gender ?? "",
          activityLevel: user?.activityLevel ?? "",
        }}
      />
    </div>
  );
}
