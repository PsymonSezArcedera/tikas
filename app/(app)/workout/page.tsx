import type { Metadata } from "next";
import { Dumbbell } from "lucide-react";

import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Workout" };

export default function WorkoutPage() {
  return (
    <PagePlaceholder
      title="Workout"
      description="Generate and manage training plans with Fortis, your strength coach."
      icon={Dumbbell}
      cards={["Active plan", "Today's session", "Generate a plan"]}
    />
  );
}
