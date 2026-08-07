import type { LucideIcon } from "lucide-react";

import { Card } from "@/components/ui/card";

// Themed empty state for sections whose content isn't built yet. Establishes
// the bento look — rounded cards on the near-black base — without real data.
export function PagePlaceholder({
  title,
  description,
  icon: Icon,
  cards,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  cards: string[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Icon className="size-5" />
        </span>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((label) => (
          <Card
            key={label}
            className="min-h-40 items-start justify-between p-5"
          >
            <span className="text-sm font-medium text-muted-foreground">
              {label}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-xs text-muted-foreground">
              <span className="size-1.5 rounded-full bg-primary" />
              Coming soon
            </span>
          </Card>
        ))}
      </div>
    </div>
  );
}
