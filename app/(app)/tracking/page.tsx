import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/db";
import { getSession } from "@/lib/session";
import type { Unit } from "@/lib/units";
import { getBodyMeasurements, getWeightLogs } from "./actions";
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

  // Fetched on the server for a no-flash first paint; TanStack Query takes over
  // on the client (optimistic inserts, refetch after each mutation).
  const [weightLogs, measurements] = await Promise.all([
    getWeightLogs(),
    getBodyMeasurements(),
  ]);

  return (
    <TrackingClient
      unit={(user?.unitPreference ?? "METRIC") as Unit}
      initialWeightLogs={weightLogs}
      initialMeasurements={measurements}
    />
  );
}
