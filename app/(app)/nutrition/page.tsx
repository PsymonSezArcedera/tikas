import type { Metadata } from "next";
import { Salad } from "lucide-react";

import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata: Metadata = { title: "Nutrition" };

export default function NutritionPage() {
  return (
    <PagePlaceholder
      title="Nutrition"
      description="Log meals and track calories and macros with Vita, your nutrition coach."
      icon={Salad}
      cards={["Today's intake", "Log food", "Macro breakdown"]}
    />
  );
}
