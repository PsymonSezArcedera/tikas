"use client";

import * as React from "react";
import { useActionState } from "react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { saveProfile, type OnboardingState } from "./actions";

type Unit = "METRIC" | "IMPERIAL";

export type OnboardingDefaults = {
  unitPreference: Unit;
  height: number | null; // cm
  weight: number | null; // kg
  goalWeight: number | null; // kg
  birthday: string; // yyyy-mm-dd
  gender: string;
  activityLevel: string;
};

const GENDERS = [
  { value: "MALE", label: "Male" },
  { value: "FEMALE", label: "Female" },
  { value: "OTHER", label: "Other" },
];

const ACTIVITY_LEVELS = [
  { value: "SEDENTARY", label: "Sedentary — little to no exercise" },
  { value: "LIGHT", label: "Light — exercise 1–3 days/week" },
  { value: "MODERATE", label: "Moderate — exercise 3–5 days/week" },
  { value: "ACTIVE", label: "Active — hard exercise 6–7 days/week" },
  { value: "VERY_ACTIVE", label: "Very active — physical job or 2x/day" },
];

// A segmented pill option, shared by the unit and gender controls.
const segmentItem =
  "flex cursor-pointer items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";
const segmentItemActive = "bg-background text-foreground shadow-sm";
const segmentGroup =
  "grid gap-1 rounded-xl border border-border bg-secondary/40 p-1";

export function OnboardingForm({ defaults }: { defaults: OnboardingDefaults }) {
  const [unit, setUnit] = React.useState<Unit>(defaults.unitPreference);
  const [state, formAction, pending] = useActionState<OnboardingState, FormData>(
    saveProfile,
    {},
  );

  const metric = unit === "METRIC";
  const today = new Date().toISOString().slice(0, 10);

  return (
    <Card>
      <CardContent className="pt-6">
        <form action={formAction} className="flex flex-col gap-5">
          {/* Units — drives the height/weight fields below */}
          <input type="hidden" name="unitPreference" value={unit} />
          <div className="flex flex-col gap-2">
            <Label>Units</Label>
            <div className={cn(segmentGroup, "grid-cols-2")}>
              {(["METRIC", "IMPERIAL"] as const).map((u) => (
                <button
                  key={u}
                  type="button"
                  onClick={() => setUnit(u)}
                  aria-pressed={unit === u}
                  className={cn(segmentItem, unit === u && segmentItemActive)}
                >
                  {u === "METRIC" ? "Metric (kg, cm)" : "Imperial (lb, ft/in)"}
                </button>
              ))}
            </div>
          </div>

          {/* Height */}
          <div className="flex flex-col gap-2">
            <Label htmlFor={metric ? "heightCm" : "heightFt"}>Height</Label>
            {metric ? (
              <Input
                id="heightCm"
                name="heightCm"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="1"
                max="300"
                placeholder="Centimetres"
                defaultValue={defaults.height ?? ""}
                required
              />
            ) : (
              <div className="grid grid-cols-2 gap-3">
                <div className="relative">
                  <Input
                    id="heightFt"
                    name="heightFt"
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="0"
                    max="9"
                    placeholder="Feet"
                    className="pr-9"
                    required
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    ft
                  </span>
                </div>
                <div className="relative">
                  <Input
                    id="heightIn"
                    name="heightIn"
                    type="number"
                    inputMode="decimal"
                    step="0.1"
                    min="0"
                    max="11"
                    placeholder="Inches"
                    className="pr-9"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                    in
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Current + goal weight */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="weight">
                Current weight ({metric ? "kg" : "lb"})
              </Label>
              <Input
                id="weight"
                name="weight"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="1"
                placeholder={metric ? "kg" : "lb"}
                defaultValue={metric ? defaults.weight ?? "" : ""}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="goalWeight">
                Goal weight ({metric ? "kg" : "lb"})
              </Label>
              <Input
                id="goalWeight"
                name="goalWeight"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="1"
                placeholder={metric ? "kg" : "lb"}
                defaultValue={metric ? defaults.goalWeight ?? "" : ""}
                required
              />
            </div>
          </div>

          {/* Birthday */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="birthday">Birthday</Label>
            <Input
              id="birthday"
              name="birthday"
              type="date"
              max={today}
              defaultValue={defaults.birthday}
              required
            />
          </div>

          {/* Gender */}
          <div className="flex flex-col gap-2">
            <Label>Gender</Label>
            <div className={cn(segmentGroup, "grid-cols-3")}>
              {GENDERS.map((g) => (
                <label key={g.value} className="contents">
                  <input
                    type="radio"
                    name="gender"
                    value={g.value}
                    defaultChecked={defaults.gender === g.value}
                    required
                    className="peer sr-only"
                  />
                  <span
                    className={cn(
                      segmentItem,
                      "peer-checked:bg-background peer-checked:text-foreground peer-checked:shadow-sm",
                    )}
                  >
                    {g.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Activity level */}
          <div className="flex flex-col gap-2">
            <Label htmlFor="activityLevel">Activity level</Label>
            <Select
              id="activityLevel"
              name="activityLevel"
              defaultValue={defaults.activityLevel}
              required
            >
              <option value="" disabled>
                Select your activity level
              </option>
              {ACTIVITY_LEVELS.map((a) => (
                <option key={a.value} value={a.value}>
                  {a.label}
                </option>
              ))}
            </Select>
          </div>

          {state.error && (
            <p className="text-sm text-destructive" role="alert">
              {state.error}
            </p>
          )}

          <Button type="submit" size="lg" disabled={pending} className="mt-1 h-11">
            {pending ? "Saving…" : "Save & continue"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
