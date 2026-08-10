import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import { todayKey } from "@/lib/day";
import type { Unit } from "@/lib/units";
import { getBodyMeasurementsForDay, getWeightLogsForDay } from "./actions";
import { TrackingClient } from "./tracking-client";

export const metadata: Metadata = { title: "Tracking" };

export default async function TrackingPage() {
  const session = await getSession();
  if (!session) {
    redirect("/sign-in");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { unitPreference: true },
  });

  // Server-computed app-day (UTC+8) so the client's default day and "no future
  // days" ceiling match how logging/streaks bucket, not the browser's local day.
  const today = todayKey();

  // Fetched on the server for a no-flash first paint; TanStack Query takes over
  // on the client (optimistic inserts, refetch after each mutation).
  const [weightLogs, measurements] = await Promise.all([
    getWeightLogsForDay(today),
    getBodyMeasurementsForDay(today),
  ]);

  return (
    <TrackingClient
      unit={(user?.unitPreference ?? "METRIC") as Unit}
      today={today}
      initialWeightLogs={weightLogs}
      initialMeasurements={measurements}
    />
  );
}
