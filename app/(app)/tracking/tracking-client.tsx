"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LineChart, Ruler, Scale } from "lucide-react";

import {
  cmToDisplay,
  displayToCm,
  displayToKg,
  kgToDisplay,
  lengthUnitLabel,
  weightUnitLabel,
  type Unit,
} from "@/lib/units";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  createBodyMeasurement,
  createWeightLog,
  getBodyMeasurements,
  getWeightLogs,
  type BodyMeasurementDTO,
  type WeightLogDTO,
} from "./actions";

const WEIGHT_KEY = ["weightLogs"] as const;
const BODY_KEY = ["bodyMeasurements"] as const;

const todayISO = () => new Date().toISOString().slice(0, 10);
const isOptimistic = (id: string) => id.startsWith("optimistic-");

// Fixed locale + UTC so server and client render the same string (no hydration
// mismatch), and the calendar day matches how it's stored.
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function TrackingClient({
  unit,
  initialWeightLogs,
  initialMeasurements,
}: {
  unit: Unit;
  initialWeightLogs: WeightLogDTO[];
  initialMeasurements: BodyMeasurementDTO[];
}) {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <LineChart className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Tracking
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Log your weight and body measurements. Entered in{" "}
            {unit === "IMPERIAL" ? "imperial" : "metric"} — your profile setting.
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <WeightCard unit={unit} initialData={initialWeightLogs} />
        <BodyCard unit={unit} initialData={initialMeasurements} />
      </div>
    </div>
  );
}

/* ------------------------------- Weight ---------------------------------- */

function WeightCard({
  unit,
  initialData,
}: {
  unit: Unit;
  initialData: WeightLogDTO[];
}) {
  const qc = useQueryClient();
  const [weight, setWeight] = React.useState("");
  const [bodyFat, setBodyFat] = React.useState("");
  const [date, setDate] = React.useState(todayISO);
  const [error, setError] = React.useState<string | null>(null);

  const { data = [] } = useQuery({
    queryKey: WEIGHT_KEY,
    queryFn: getWeightLogs,
    initialData,
  });

  const mutation = useMutation({
    mutationFn: async (input: {
      weight: string;
      bodyFat?: string;
      date?: string;
    }) => {
      const res = await createWeightLog(input);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async (input) => {
      setError(null);
      await qc.cancelQueries({ queryKey: WEIGHT_KEY });
      const prev = qc.getQueryData<WeightLogDTO[]>(WEIGHT_KEY) ?? [];
      const optimistic: WeightLogDTO = {
        id: `optimistic-${Date.now()}`,
        weight: displayToKg(Number(input.weight), unit),
        bodyFat: input.bodyFat ? Number(input.bodyFat) : null,
        date: new Date(input.date ? input.date : todayISO()).toISOString(),
      };
      qc.setQueryData<WeightLogDTO[]>(WEIGHT_KEY, [optimistic, ...prev]);
      return { prev };
    },
    onError: (err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(WEIGHT_KEY, ctx.prev);
      setError(err instanceof Error ? err.message : "Could not save entry");
    },
    onSuccess: () => {
      setWeight("");
      setBodyFat("");
      setDate(todayISO());
    },
    onSettled: () => qc.invalidateQueries({ queryKey: WEIGHT_KEY }),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!weight.trim()) {
      setError("Enter a weight");
      return;
    }
    mutation.mutate({
      weight,
      bodyFat: bodyFat.trim() || undefined,
      date: date || undefined,
    });
  }

  const latest = data[0];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Scale className="size-4 text-primary" />
          <CardTitle>Weight</CardTitle>
        </div>
        <CardDescription>
          {latest
            ? `Latest: ${kgToDisplay(latest.weight, unit)} ${weightUnitLabel(unit)}`
            : "No entries yet — log your first weigh-in."}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="weight">Weight ({weightUnitLabel(unit)})</Label>
              <Input
                id="weight"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="1"
                placeholder={weightUnitLabel(unit)}
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="bodyFat">Body fat % (optional)</Label>
              <Input
                id="bodyFat"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                max="100"
                placeholder="%"
                value={bodyFat}
                onChange={(e) => setBodyFat(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="weightDate">Date</Label>
            <Input
              id="weightDate"
              type="date"
              max={todayISO()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={mutation.isPending} className="h-10">
            {mutation.isPending ? "Saving…" : "Log weight"}
          </Button>
        </form>

        <EntryList
          rows={data}
          empty="Your weigh-ins will show up here."
          render={(r) => (
            <>
              <span className="font-medium text-foreground">
                {kgToDisplay(r.weight, unit)} {weightUnitLabel(unit)}
              </span>
              {r.bodyFat != null && (
                <span className="text-muted-foreground"> · {r.bodyFat}% fat</span>
              )}
            </>
          )}
        />
      </CardContent>
    </Card>
  );
}

/* --------------------------- Body measurements --------------------------- */

const BODY_FIELDS = [
  { key: "waist", label: "Waist" },
  { key: "chest", label: "Chest" },
  { key: "leftArm", label: "Left arm" },
  { key: "rightArm", label: "Right arm" },
] as const;

type BodyFieldKey = (typeof BODY_FIELDS)[number]["key"];

function BodyCard({
  unit,
  initialData,
}: {
  unit: Unit;
  initialData: BodyMeasurementDTO[];
}) {
  const qc = useQueryClient();
  const emptyForm: Record<BodyFieldKey, string> = {
    waist: "",
    chest: "",
    leftArm: "",
    rightArm: "",
  };
  const [values, setValues] = React.useState(emptyForm);
  const [date, setDate] = React.useState(todayISO);
  const [error, setError] = React.useState<string | null>(null);

  const { data = [] } = useQuery({
    queryKey: BODY_KEY,
    queryFn: getBodyMeasurements,
    initialData,
  });

  const mutation = useMutation({
    mutationFn: async (input: Record<BodyFieldKey, string> & { date?: string }) => {
      const res = await createBodyMeasurement(input);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async (input) => {
      setError(null);
      await qc.cancelQueries({ queryKey: BODY_KEY });
      const prev = qc.getQueryData<BodyMeasurementDTO[]>(BODY_KEY) ?? [];
      const toCm = (v: string) =>
        v.trim() ? displayToCm(Number(v), unit) : null;
      const optimistic: BodyMeasurementDTO = {
        id: `optimistic-${Date.now()}`,
        waist: toCm(input.waist),
        chest: toCm(input.chest),
        leftArm: toCm(input.leftArm),
        rightArm: toCm(input.rightArm),
        date: new Date(input.date ? input.date : todayISO()).toISOString(),
      };
      qc.setQueryData<BodyMeasurementDTO[]>(BODY_KEY, [optimistic, ...prev]);
      return { prev };
    },
    onError: (err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(BODY_KEY, ctx.prev);
      setError(err instanceof Error ? err.message : "Could not save entry");
    },
    onSuccess: () => {
      setValues(emptyForm);
      setDate(todayISO());
    },
    onSettled: () => qc.invalidateQueries({ queryKey: BODY_KEY }),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const anyValue = BODY_FIELDS.some((f) => values[f.key].trim());
    if (!anyValue) {
      setError("Enter at least one measurement");
      return;
    }
    mutation.mutate({ ...values, date: date || undefined });
  }

  const label = lengthUnitLabel(unit);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Ruler className="size-4 text-primary" />
          <CardTitle>Body measurements</CardTitle>
        </div>
        <CardDescription>
          Track waist, chest, and arms in {label}. Fill in any you have.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {BODY_FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col gap-2">
                <Label htmlFor={f.key}>
                  {f.label} ({label})
                </Label>
                <Input
                  id={f.key}
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="1"
                  placeholder={label}
                  value={values[f.key]}
                  onChange={(e) =>
                    setValues((v) => ({ ...v, [f.key]: e.target.value }))
                  }
                />
              </div>
            ))}
          </div>
          <div className="flex flex-col gap-2">
            <Label htmlFor="bodyDate">Date</Label>
            <Input
              id="bodyDate"
              type="date"
              max={todayISO()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}

          <Button type="submit" disabled={mutation.isPending} className="h-10">
            {mutation.isPending ? "Saving…" : "Log measurements"}
          </Button>
        </form>

        <EntryList
          rows={data}
          empty="Your measurements will show up here."
          render={(r) => {
            const parts = BODY_FIELDS.filter((f) => r[f.key] != null).map(
              (f) =>
                `${f.label} ${cmToDisplay(r[f.key] as number, unit)}${label}`,
            );
            return (
              <span className="font-medium text-foreground">
                {parts.join(" · ")}
              </span>
            );
          }}
        />
      </CardContent>
    </Card>
  );
}

/* -------------------------------- Shared --------------------------------- */

function EntryList<T extends { id: string; date: string }>({
  rows,
  render,
  empty,
}: {
  rows: T[];
  render: (row: T) => React.ReactNode;
  empty: string;
}) {
  if (rows.length === 0) {
    return (
      <p className="border-t border-border pt-4 text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }

  return (
    <ul className="flex flex-col border-t border-border">
      {rows.map((row) => (
        <li
          key={row.id}
          className={cn(
            "flex items-center justify-between gap-3 border-b border-border py-2.5 text-sm last:border-b-0",
            isOptimistic(row.id) && "opacity-60",
          )}
        >
          <span className="text-muted-foreground">{formatDate(row.date)}</span>
          <span className="text-right">{render(row)}</span>
        </li>
      ))}
    </ul>
  );
}
