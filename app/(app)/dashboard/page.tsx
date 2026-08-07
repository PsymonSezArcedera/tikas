import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { LayoutDashboard } from "lucide-react";

import { getSession } from "@/lib/session";
import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Dashboard" };

// Protected route. The (app) layout already guards the session; we re-read it
// here to greet the user. Real dashboard content (weight, streak, calories)
// comes in Phase 2 — this is the themed shell only.
export default async function DashboardPage() {
  const session = await getSession();

  if (!session) {
    redirect("/sign-in");
  }

  const firstName = session.user.name?.trim().split(" ")[0];

  return (
    <PagePlaceholder
      title={firstName ? `Welcome back, ${firstName}` : "Welcome back"}
      description="Your fitness overview lives here — weight, calories, streaks, and progress."
      icon={LayoutDashboard}
      cards={["Current weight", "Calories today", "Streak", "Macros", "Workouts", "Progress"]}
    />
  );
}
