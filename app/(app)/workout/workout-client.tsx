"use client";

import * as React from "react";
import { useActionState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Dumbbell, Sparkles } from "lucide-react";

import {
  EQUIPMENT_OPTIONS,
  FOCUS_OPTIONS,
  INTENSITIES,
  WORKOUT_GOALS,
} from "@/lib/validations";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import {
  generatePlan,
  getLatestPlan,
  type GenerateState,
  type PlanDTO,
} from "./actions";
import { PlanView, PLAN_KEY } from "./plan-view";

const DEFAULT_EQUIPMENT = new Set(["Bodyweight", "Dumbbells"]);
const DEFAULT_FOCUS = new Set(["Full body"]);

const chip =
  "flex cursor-pointer items-center justify-center rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground peer-checked:border-primary/60 peer-checked:bg-primary/10 peer-checked:text-foreground";

const segment =
  "flex cursor-pointer items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-sm";

export function WorkoutClient({ initialPlan }: { initialPlan: PlanDTO | null }) {
  const qc = useQueryClient();
  const [state, formAction, pending] = useActionState<GenerateState, FormData>(
    generatePlan,
    {},
  );

  // The displayed plan is cache-backed so inline edits (add/edit/delete) update
  // it optimistically. The server-rendered plan seeds the cache.
  const { data: plan } = useQuery({
    queryKey: PLAN_KEY,
    queryFn: getLatestPlan,
    initialData: initialPlan,
  });

  // A freshly generated plan (from the form action) becomes the displayed plan.
  React.useEffect(() => {
    if (state.plan) qc.setQueryData(PLAN_KEY, state.plan);
  }, [state.plan, qc]);

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Dumbbell className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Workout
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Generate a training plan with Fortis, your strength coach.
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-[22rem_1fr] lg:items-start">
        <Card>
          <CardHeader>
            <CardTitle>Plan setup</CardTitle>
            <CardDescription>
              Tell Fortis what you&apos;re working with.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form action={formAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <Label htmlFor="goal">Goal</Label>
                <Select id="goal" name="goal" defaultValue="Build muscle">
                  {WORKOUT_GOALS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="daysPerWeek">Days / week</Label>
                  <Select id="daysPerWeek" name="daysPerWeek" defaultValue="3">
                    {[1, 2, 3, 4, 5, 6].map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </Select>
                </div>
                <div className="flex flex-col gap-2">
                  <Label htmlFor="sessionMinutes">Time / session</Label>
                  <Select
                    id="sessionMinutes"
                    name="sessionMinutes"
                    defaultValue="60"
                  >
                    {[30, 45, 60, 75, 90].map((m) => (
                      <option key={m} value={m}>
                        {m} min
                      </option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Intensity</Label>
                <div className="grid grid-cols-3 gap-1 rounded-xl border border-border bg-secondary/40 p-1">
                  {INTENSITIES.map((i) => (
                    <label key={i} className="contents">
                      <input
                        type="radio"
                        name="intensity"
                        value={i}
                        defaultChecked={i === "Moderate"}
                        className="peer sr-only"
                      />
                      <span className={segment}>{i}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Equipment</Label>
                <div className="grid grid-cols-2 gap-2">
                  {EQUIPMENT_OPTIONS.map((opt) => (
                    <label key={opt} className="contents">
                      <input
                        type="checkbox"
                        name="equipment"
                        value={opt}
                        defaultChecked={DEFAULT_EQUIPMENT.has(opt)}
                        className="peer sr-only"
                      />
                      <span className={chip}>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label>Target muscle groups</Label>
                <div className="grid grid-cols-2 gap-2">
                  {FOCUS_OPTIONS.map((opt) => (
                    <label key={opt} className="contents">
                      <input
                        type="checkbox"
                        name="muscleGroups"
                        value={opt}
                        defaultChecked={DEFAULT_FOCUS.has(opt)}
                        className="peer sr-only"
                      />
                      <span className={chip}>{opt}</span>
                    </label>
                  ))}
                </div>
              </div>

              {state.error && (
                <p className="text-sm text-destructive" role="alert">
                  {state.error}
                </p>
              )}

              <Button type="submit" disabled={pending} className="h-11">
                <Sparkles />
                {pending ? "Generating…" : "Generate plan"}
              </Button>
              {pending && (
                <p className="text-center text-xs text-muted-foreground">
                  Fortis is putting your plan together…
                </p>
              )}
            </form>
          </CardContent>
        </Card>

        {plan ? (
          <PlanView plan={plan} />
        ) : (
          <Card className="items-center justify-center p-10 text-center">
            <div className="flex flex-col items-center gap-2">
              <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <Dumbbell className="size-6" />
              </span>
              <p className="text-sm font-medium">No plan yet</p>
              <p className="max-w-xs text-sm text-muted-foreground">
                Set your preferences and generate a plan — it&apos;ll appear here,
                grouped by day.
              </p>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
