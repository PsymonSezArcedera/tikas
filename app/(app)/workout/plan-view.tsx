import { Dumbbell } from "lucide-react";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { ExerciseDTO, PlanDTO } from "./actions";

function groupByDay(exercises: ExerciseDTO[]): [string, ExerciseDTO[]][] {
  const groups = new Map<string, ExerciseDTO[]>();
  for (const e of exercises) {
    const list = groups.get(e.day);
    if (list) list.push(e);
    else groups.set(e.day, [e]);
  }
  return [...groups.entries()];
}

function MetaBadge({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-secondary px-2.5 py-1 text-xs font-medium text-muted-foreground">
      {children}
    </span>
  );
}

export function PlanView({ plan }: { plan: PlanDTO }) {
  const days = groupByDay(plan.exercises);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">
          <Dumbbell className="size-4" />
          <span className="text-xs font-medium uppercase tracking-wider">
            Your plan
          </span>
        </div>
        <CardTitle className="text-2xl">{plan.title}</CardTitle>
        <div className="mt-2 flex flex-wrap gap-2">
          <MetaBadge>{plan.goal}</MetaBadge>
          <MetaBadge>{plan.intensity} intensity</MetaBadge>
          <MetaBadge>
            {plan.days} {plan.days === 1 ? "day" : "days"}/week
          </MetaBadge>
          <MetaBadge>{plan.duration} min/session</MetaBadge>
        </div>
      </CardHeader>
      <CardContent className="flex flex-col gap-6">
        {days.map(([day, exercises]) => (
          <section key={day} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between border-b border-border pb-2">
              <h3 className="font-display text-sm font-semibold uppercase tracking-wide">
                {day}
              </h3>
              <span className="text-xs text-muted-foreground">
                {exercises.length}{" "}
                {exercises.length === 1 ? "exercise" : "exercises"}
              </span>
            </div>
            <ul className="flex flex-col">
              {exercises.map((e) => (
                <li
                  key={e.id}
                  className="flex items-start justify-between gap-4 border-b border-border py-3 last:border-b-0"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{e.exercise}</p>
                    {e.notes ? (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {e.notes}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="font-display text-sm font-semibold tracking-tight">
                      {e.sets} × {e.reps}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      rest {e.rest}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
