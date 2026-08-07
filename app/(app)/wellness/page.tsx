import type { Metadata } from "next";
import { Sparkles } from "lucide-react";

import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Wellness" };

export default function WellnessPage() {
  return (
    <PagePlaceholder
      title="Wellness"
      description="Sleep, recovery, and habits with Lux, your wellness coach."
      icon={Sparkles}
      cards={["Recovery", "Habits", "Chat with Lux"]}
    />
  );
}
