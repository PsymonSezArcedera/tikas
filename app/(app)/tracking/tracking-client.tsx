"use client";

import * as React from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { LineChart, Pencil, Ruler, Scale, Trash2 } from "lucide-react";

import {
  cmToDisplay,
  displayToCm,
  displayToKg,
  kgToDisplay,
  lengthUnitLabel,
  weightUnitLabel,
  type Unit,
} from "@/lib/units";
import { addDays } from "@/lib/day";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DateNav, formatDay } from "@/components/date-nav";
import { InlineError } from "@/components/inline-error";
import {
  createBodyMeasurement,
  createWeightLog,
  deleteBodyMeasurement,
  deleteWeightLog,
  getBodyMeasurementsForDay,
  getWeightLogsForDay,
  updateBodyMeasurement,
  updateWeightLog,
  type BodyMeasurementDTO,
  type WeightLogDTO,
} from "./actions";

// Per-day cache keys. A broad ["weightLogs"] / ["bodyMeasurements"] invalidation
// still matches every day's query (partial match), so mutations refresh all
// cached days at once.
const weightKey = (day: string) => ["weightLogs", day] as const;
const bodyKey = (day: string) => ["bodyMeasurements", day] as const;

const msg = (e: unknown, fallback: string) =>
  e instanceof Error ? e.message : fallback;

export function TrackingClient({
  unit,
  today,
  initialWeightLogs,
  initialMeasurements,
}: {
  unit: Unit;
  today: string;
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
        <WeightCard unit={unit} today={today} initialData={initialWeightLogs} />
        <BodyCard unit={unit} today={today} initialData={initialMeasurements} />
      </div>
    </div>
  );
}

/* ------------------------------- Weight ---------------------------------- */

type WeightForm = { weight: string; bodyFat: string };
const emptyWeight: WeightForm = { weight: "", bodyFat: "" };

function WeightCard({
  unit,
  today,
  initialData,
}: {
  unit: Unit;
  today: string;
  initialData: WeightLogDTO[];
}) {
  const qc = useQueryClient();
  const [day, setDay] = React.useState(today);
  const isToday = day === today;
  const [form, setForm] = React.useState(emptyWeight);
  const [error, setError] = React.useState<string | null>(null);

  const [editing, setEditing] = React.useState<WeightLogDTO | null>(null);
  const [editForm, setEditForm] = React.useState(emptyWeight);
  const [editError, setEditError] = React.useState<string | null>(null);

  const [deleting, setDeleting] = React.useState<WeightLogDTO | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const {
    data = [],
    isPlaceholderData,
    isError,
    error: fetchError,
    refetch,
  } = useQuery({
    queryKey: weightKey(day),
    queryFn: () => getWeightLogsForDay(day),
    initialData: isToday ? initialData : undefined,
    placeholderData: keepPreviousData,
  });

  // See nutrition-client: keepPreviousData + seeded today masks isError, so the
  // failure shows on `error` while placeholder data is displayed. Cover both.
  const loadFailed = isError || (isPlaceholderData && fetchError != null);

  const wlabel = weightUnitLabel(unit);

  const optimistic = (id: string, f: WeightForm, d: string): WeightLogDTO => ({
    id,
    weight: displayToKg(Number(f.weight), unit),
    bodyFat: f.bodyFat.trim() ? Number(f.bodyFat) : null,
    date: d === today ? new Date().toISOString() : `${d}T12:00:00.000Z`,
  });

  const createMutation = useMutation({
    mutationFn: async (vars: { input: WeightForm; day: string }) => {
      const res = await createWeightLog(vars.input, vars.day);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async (vars) => {
      setError(null);
      const key = weightKey(vars.day);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<WeightLogDTO[]>(key) ?? [];
      qc.setQueryData<WeightLogDTO[]>(key, [
        optimistic(`optimistic-${Date.now()}`, vars.input, vars.day),
        ...prev,
      ]);
      return { prev, key };
    },
    onError: (err, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      setError(msg(err, "Could not save entry"));
    },
    onSuccess: () => setForm(emptyWeight),
    onSettled: () => qc.invalidateQueries({ queryKey: ["weightLogs"] }),
  });

  const updateMutation = useMutation({
    mutationFn: async (vars: { id: string; input: WeightForm; day: string }) => {
      const res = await updateWeightLog(vars.id, vars.input);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async (vars) => {
      setEditError(null);
      const key = weightKey(vars.day);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<WeightLogDTO[]>(key) ?? [];
      const patched: WeightLogDTO = {
        ...optimistic(vars.id, vars.input, vars.day),
        date: editing?.date ?? new Date().toISOString(),
      };
      qc.setQueryData<WeightLogDTO[]>(
        key,
        prev.map((r) => (r.id === vars.id ? patched : r)),
      );
      return { prev, key };
    },
    onError: (err, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      setEditError(msg(err, "Could not update entry"));
    },
    onSuccess: () => setEditing(null),
    onSettled: () => qc.invalidateQueries({ queryKey: ["weightLogs"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (vars: { id: string; day: string }) => {
      const res = await deleteWeightLog(vars.id);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async (vars) => {
      setDeleteError(null);
      const key = weightKey(vars.day);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<WeightLogDTO[]>(key) ?? [];
      qc.setQueryData<WeightLogDTO[]>(
        key,
        prev.filter((r) => r.id !== vars.id),
      );
      return { prev, key };
    },
    onError: (err, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      setDeleteError(msg(err, "Could not delete entry"));
    },
    onSuccess: () => setDeleting(null),
    onSettled: () => qc.invalidateQueries({ queryKey: ["weightLogs"] }),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.weight.trim()) return setError("Enter a weight");
    createMutation.mutate({ input: form, day });
  }

  function openEdit(r: WeightLogDTO) {
    setEditForm({
      weight: String(kgToDisplay(r.weight, unit)),
      bodyFat: r.bodyFat != null ? String(r.bodyFat) : "",
    });
    setEditError(null);
    setEditing(r);
  }

  function onEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!editForm.weight.trim()) return setEditError("Enter a weight");
    updateMutation.mutate({ id: editing.id, input: editForm, day });
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Scale className="size-4 text-primary" />
            <CardTitle>Weight</CardTitle>
          </div>
          <DateNav
            day={day}
            today={today}
            onChange={setDay}
            onStep={(n) => setDay((d) => addDays(d, n))}
          />
        </div>
        <CardDescription>
          {loadFailed
            ? "Couldn't load this day."
            : data.length
              ? `${formatDay(day, today)}: ${kgToDisplay(data[0].weight, unit)} ${wlabel}`
              : "No weigh-in on this day."}
        </CardDescription>
      </CardHeader>
      <CardContent
        className={cn(
          "flex flex-col gap-5 transition-opacity",
          isPlaceholderData && !loadFailed && "opacity-50",
        )}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-weight">Weight ({wlabel})</Label>
              <Input
                id="new-weight"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="1"
                placeholder={wlabel}
                value={form.weight}
                onChange={(e) =>
                  setForm((f) => ({ ...f, weight: e.target.value }))
                }
                required
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-bodyFat">Body fat % (optional)</Label>
              <Input
                id="new-bodyFat"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                max="100"
                placeholder="%"
                value={form.bodyFat}
                onChange={(e) =>
                  setForm((f) => ({ ...f, bodyFat: e.target.value }))
                }
              />
            </div>
          </div>

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {!isToday && (
            <p className="text-xs text-muted-foreground">
              Adding to {formatDay(day, today)}.
            </p>
          )}

          <Button type="submit" disabled={createMutation.isPending} className="h-10">
            {createMutation.isPending
              ? "Saving…"
              : isToday
                ? "Log weight"
                : `Log to ${formatDay(day, today)}`}
          </Button>
        </form>

        <DayEntryList
          rows={data}
          emptyText="No weigh-in logged on this day."
          error={loadFailed}
          onRetry={() => refetch()}
          onEdit={openEdit}
          onDelete={(r) => {
            setDeleteError(null);
            setDeleting(r);
          }}
          render={(r) => (
            <>
              <span className="font-medium text-foreground">
                {kgToDisplay(r.weight, unit)} {wlabel}
              </span>
              {r.bodyFat != null && (
                <span className="text-muted-foreground"> · {r.bodyFat}% fat</span>
              )}
            </>
          )}
        />
      </CardContent>

      {/* Edit weigh-in */}
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="font-display text-lg font-semibold tracking-tight">
            Edit weigh-in
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Update your weight and save.
          </DialogDescription>
          <form onSubmit={onEditSubmit} className="mt-4 flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-weight">Weight ({wlabel})</Label>
                <Input
                  id="edit-weight"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="1"
                  placeholder={wlabel}
                  value={editForm.weight}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, weight: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-bodyFat">Body fat % (optional)</Label>
                <Input
                  id="edit-bodyFat"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="0"
                  max="100"
                  placeholder="%"
                  value={editForm.bodyFat}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, bodyFat: e.target.value }))
                  }
                />
              </div>
            </div>

            {editError && (
              <p className="text-sm text-destructive" role="alert">
                {editError}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="h-10 flex-1"
              >
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting && deleteMutation.mutate({ id: deleting.id, day })
        }
        pending={deleteMutation.isPending}
        error={deleteError}
        description={
          <>
            Remove{" "}
            {deleting
              ? `${kgToDisplay(deleting.weight, unit)} ${wlabel} weigh-in`
              : "this entry"}{" "}
            from this day? This can&apos;t be undone.
          </>
        }
      />
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
type BodyForm = Record<BodyFieldKey, string>;
const emptyBody: BodyForm = { waist: "", chest: "", leftArm: "", rightArm: "" };

function BodyCard({
  unit,
  today,
  initialData,
}: {
  unit: Unit;
  today: string;
  initialData: BodyMeasurementDTO[];
}) {
  const qc = useQueryClient();
  const [day, setDay] = React.useState(today);
  const isToday = day === today;
  const [form, setForm] = React.useState(emptyBody);
  const [error, setError] = React.useState<string | null>(null);

  const [editing, setEditing] = React.useState<BodyMeasurementDTO | null>(null);
  const [editForm, setEditForm] = React.useState(emptyBody);
  const [editError, setEditError] = React.useState<string | null>(null);

  const [deleting, setDeleting] = React.useState<BodyMeasurementDTO | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const {
    data = [],
    isPlaceholderData,
    isError,
    error: fetchError,
    refetch,
  } = useQuery({
    queryKey: bodyKey(day),
    queryFn: () => getBodyMeasurementsForDay(day),
    initialData: isToday ? initialData : undefined,
    placeholderData: keepPreviousData,
  });

  const loadFailed = isError || (isPlaceholderData && fetchError != null);

  const label = lengthUnitLabel(unit);

  const toCm = (v: string) => (v.trim() ? displayToCm(Number(v), unit) : null);
  const optimistic = (
    id: string,
    f: BodyForm,
    d: string,
  ): BodyMeasurementDTO => ({
    id,
    waist: toCm(f.waist),
    chest: toCm(f.chest),
    leftArm: toCm(f.leftArm),
    rightArm: toCm(f.rightArm),
    date: d === today ? new Date().toISOString() : `${d}T12:00:00.000Z`,
  });

  const createMutation = useMutation({
    mutationFn: async (vars: { input: BodyForm; day: string }) => {
      const res = await createBodyMeasurement(vars.input, vars.day);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async (vars) => {
      setError(null);
      const key = bodyKey(vars.day);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<BodyMeasurementDTO[]>(key) ?? [];
      qc.setQueryData<BodyMeasurementDTO[]>(key, [
        optimistic(`optimistic-${Date.now()}`, vars.input, vars.day),
        ...prev,
      ]);
      return { prev, key };
    },
    onError: (err, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      setError(msg(err, "Could not save entry"));
    },
    onSuccess: () => setForm(emptyBody),
    onSettled: () => qc.invalidateQueries({ queryKey: ["bodyMeasurements"] }),
  });

  const updateMutation = useMutation({
    mutationFn: async (vars: { id: string; input: BodyForm; day: string }) => {
      const res = await updateBodyMeasurement(vars.id, vars.input);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async (vars) => {
      setEditError(null);
      const key = bodyKey(vars.day);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<BodyMeasurementDTO[]>(key) ?? [];
      const patched: BodyMeasurementDTO = {
        ...optimistic(vars.id, vars.input, vars.day),
        date: editing?.date ?? new Date().toISOString(),
      };
      qc.setQueryData<BodyMeasurementDTO[]>(
        key,
        prev.map((r) => (r.id === vars.id ? patched : r)),
      );
      return { prev, key };
    },
    onError: (err, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      setEditError(msg(err, "Could not update entry"));
    },
    onSuccess: () => setEditing(null),
    onSettled: () => qc.invalidateQueries({ queryKey: ["bodyMeasurements"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (vars: { id: string; day: string }) => {
      const res = await deleteBodyMeasurement(vars.id);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async (vars) => {
      setDeleteError(null);
      const key = bodyKey(vars.day);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<BodyMeasurementDTO[]>(key) ?? [];
      qc.setQueryData<BodyMeasurementDTO[]>(
        key,
        prev.filter((r) => r.id !== vars.id),
      );
      return { prev, key };
    },
    onError: (err, _v, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      setDeleteError(msg(err, "Could not delete entry"));
    },
    onSuccess: () => setDeleting(null),
    onSettled: () => qc.invalidateQueries({ queryKey: ["bodyMeasurements"] }),
  });

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!BODY_FIELDS.some((f) => form[f.key].trim()))
      return setError("Enter at least one measurement");
    createMutation.mutate({ input: form, day });
  }

  function openEdit(r: BodyMeasurementDTO) {
    const g = (v: number | null) =>
      v != null ? String(cmToDisplay(v, unit)) : "";
    setEditForm({
      waist: g(r.waist),
      chest: g(r.chest),
      leftArm: g(r.leftArm),
      rightArm: g(r.rightArm),
    });
    setEditError(null);
    setEditing(r);
  }

  function onEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!BODY_FIELDS.some((f) => editForm[f.key].trim()))
      return setEditError("Enter at least one measurement");
    updateMutation.mutate({ id: editing.id, input: editForm, day });
  }

  const renderFields = (
    values: BodyForm,
    set: (key: BodyFieldKey, value: string) => void,
    idPrefix: string,
  ) => (
    <div className="grid gap-4 sm:grid-cols-2">
      {BODY_FIELDS.map((f) => (
        <div key={f.key} className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-${f.key}`}>
            {f.label} ({label})
          </Label>
          <Input
            id={`${idPrefix}-${f.key}`}
            type="number"
            inputMode="decimal"
            step="0.1"
            min="1"
            placeholder={label}
            value={values[f.key]}
            onChange={(e) => set(f.key, e.target.value)}
          />
        </div>
      ))}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Ruler className="size-4 text-primary" />
            <CardTitle>Body measurements</CardTitle>
          </div>
          <DateNav
            day={day}
            today={today}
            onChange={setDay}
            onStep={(n) => setDay((d) => addDays(d, n))}
          />
        </div>
        <CardDescription>
          Track waist, chest, and arms in {label}. Fill in any you have.
        </CardDescription>
      </CardHeader>
      <CardContent
        className={cn(
          "flex flex-col gap-5 transition-opacity",
          isPlaceholderData && !loadFailed && "opacity-50",
        )}
      >
        <form onSubmit={onSubmit} className="flex flex-col gap-4">
          {renderFields(
            form,
            (key, value) => setForm((v) => ({ ...v, [key]: value })),
            "new",
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {!isToday && (
            <p className="text-xs text-muted-foreground">
              Adding to {formatDay(day, today)}.
            </p>
          )}

          <Button type="submit" disabled={createMutation.isPending} className="h-10">
            {createMutation.isPending
              ? "Saving…"
              : isToday
                ? "Log measurements"
                : `Log to ${formatDay(day, today)}`}
          </Button>
        </form>

        <DayEntryList
          rows={data}
          emptyText="No measurements logged on this day."
          error={loadFailed}
          onRetry={() => refetch()}
          onEdit={openEdit}
          onDelete={(r) => {
            setDeleteError(null);
            setDeleting(r);
          }}
          render={(r) => {
            const parts = BODY_FIELDS.filter((f) => r[f.key] != null).map(
              (f) => `${f.label} ${cmToDisplay(r[f.key] as number, unit)}${label}`,
            );
            return (
              <span className="font-medium text-foreground">
                {parts.join(" · ")}
              </span>
            );
          }}
        />
      </CardContent>

      {/* Edit measurements */}
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="font-display text-lg font-semibold tracking-tight">
            Edit measurements
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Update any measurement and save. Clear a field to remove it.
          </DialogDescription>
          <form onSubmit={onEditSubmit} className="mt-4 flex flex-col gap-4">
            {renderFields(
              editForm,
              (key, value) => setEditForm((v) => ({ ...v, [key]: value })),
              "edit",
            )}

            {editError && (
              <p className="text-sm text-destructive" role="alert">
                {editError}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={updateMutation.isPending}
                className="h-10 flex-1"
              >
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => setEditing(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        onConfirm={() =>
          deleting && deleteMutation.mutate({ id: deleting.id, day })
        }
        pending={deleteMutation.isPending}
        error={deleteError}
        description={<>Remove these measurements from this day? This can&apos;t be undone.</>}
      />
    </Card>
  );
}

/* -------------------------------- Shared --------------------------------- */

// Per-day entry list with inline edit/delete. Optimistic (not-yet-persisted)
// rows have no real id to act on, so their actions are hidden.
function DayEntryList<T extends { id: string }>({
  rows,
  render,
  emptyText,
  onEdit,
  onDelete,
  error = false,
  onRetry,
}: {
  rows: T[];
  render: (row: T) => React.ReactNode;
  emptyText: string;
  onEdit: (row: T) => void;
  onDelete: (row: T) => void;
  // When the day's fetch failed and there's nothing to show, surface an error
  // instead of the (misleading) empty text.
  error?: boolean;
  onRetry?: () => void;
}) {
  // A failed fetch takes priority over any rows — with keepPreviousData those
  // rows are a stale placeholder from another day, so show the error instead.
  if (error) {
    return (
      <div className="border-t border-border pt-4">
        <InlineError
          message="Couldn't load this day's entries. Check your connection and try again."
          onRetry={onRetry}
        />
      </div>
    );
  }
  if (rows.length === 0) {
    return (
      <p className="border-t border-border pt-4 text-sm text-muted-foreground">
        {emptyText}
      </p>
    );
  }

  return (
    <ul className="flex flex-col border-t border-border">
      {rows.map((row) => {
        const pending = row.id.startsWith("optimistic-");
        return (
          <li
            key={row.id}
            className={cn(
              "flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0",
              pending && "opacity-60",
            )}
          >
            <span className="min-w-0">{render(row)}</span>
            {!pending && (
              <span className="flex shrink-0 items-center gap-0.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-foreground"
                  aria-label="Edit entry"
                  onClick={() => onEdit(row)}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="text-muted-foreground hover:text-destructive"
                  aria-label="Delete entry"
                  onClick={() => onDelete(row)}
                >
                  <Trash2 />
                </Button>
              </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
