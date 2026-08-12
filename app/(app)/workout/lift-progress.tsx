"use client";

import * as React from "react";
import { Dialog as BaseDialog } from "@base-ui/react/dialog";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CartesianGrid,
  Line,
  LineChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Dumbbell, Pencil, Trophy, Trash2, X } from "lucide-react";

import { addDays, dayKey } from "@/lib/day";
import { displayToKg, kgToDisplay, weightUnitLabel, type Unit } from "@/lib/units";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
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
import {
  AXIS_TICK,
  ChartContainer,
  ChartTooltip,
  GRID_STROKE,
} from "@/components/ui/chart";
import {
  deleteLift,
  getLiftLogs,
  logLift,
  updateLift,
  type ExerciseDTO,
  type LiftLogDTO,
} from "./actions";

export const LIFT_KEY = ["liftLogs"] as const;

const msg = (e: unknown, fallback: string) =>
  e instanceof Error ? e.message : fallback;

// A lift's calendar day comes from its stored instant via the UTC+8 boundary —
// NOT to be confused with the plan's structural "Day 1 / Day 3" labels.
const dayKeyOf = (iso: string) => dayKey(new Date(iso));

// "Aug 4" style — for the PR line and chart axis.
function shortDate(key: string): string {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

const normalize = (name: string) => name.trim().toLowerCase();

type ExerciseGroup = {
  key: string; // normalized name — the grouping key
  name: string; // display name (most recent variant)
  logs: LiftLogDTO[]; // chronological (oldest first)
  pr: LiftLogDTO; // heaviest set ever (earliest date on ties)
};

// Pool a single exercise's logs across every plan/day (matched by normalized
// name), then derive the PR (max weight, earliest achievement on ties) and keep
// the history chronological. Returns null when nothing's been logged yet.
function buildGroup(logs: LiftLogDTO[], key: string): ExerciseGroup | null {
  const arr = logs.filter((l) => normalize(l.exerciseName) === key);
  if (arr.length === 0) return null;
  const sorted = [...arr].sort((a, b) => a.date.localeCompare(b.date));
  // Strict `>` keeps the earliest set at the max weight (sorted is asc by date).
  const pr = sorted.reduce(
    (best, cur) => (cur.weight > best.weight ? cur : best),
    sorted[0],
  );
  return { key, name: sorted[sorted.length - 1].exerciseName, logs: sorted, pr };
}

// Best (heaviest) set per calendar day → a clean progression line over real time.
function chartData(group: ExerciseGroup, unit: Unit) {
  const perDay = new Map<string, LiftLogDTO>();
  for (const l of group.logs) {
    const k = dayKeyOf(l.date);
    const cur = perDay.get(k);
    if (!cur || l.weight > cur.weight) perDay.set(k, l);
  }
  return [...perDay.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([k, l]) => ({
      label: shortDate(k),
      weight: kgToDisplay(l.weight, unit),
      reps: l.reps,
    }));
}

// sm breakpoint — desktop gets a centered modal, mobile a bottom sheet.
function useIsDesktop() {
  const [desktop, setDesktop] = React.useState(false);
  React.useEffect(() => {
    const mq = window.matchMedia("(min-width: 640px)");
    const sync = () => setDesktop(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);
  return desktop;
}

const DESKTOP_POPUP =
  "fixed left-1/2 top-1/2 z-50 flex max-h-[calc(100dvh-4rem)] w-[calc(100%-2rem)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-2xl border border-border bg-popover text-popover-foreground shadow-2xl outline-none transition-all duration-200 ease-out data-[ending-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:scale-95 data-[starting-style]:opacity-0";

const MOBILE_POPUP =
  "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col overflow-hidden rounded-t-2xl border-t border-border bg-popover text-popover-foreground shadow-2xl outline-none transition-transform duration-300 ease-out data-[ending-style]:translate-y-full data-[starting-style]:translate-y-full";

/**
 * Per-exercise hub — opened by tapping an exercise row. Consolidates the PR (with
 * its calendar date), the progression chart, the full history (edit/delete per
 * entry), and the log input. Everything is pooled by normalized exercise name
 * across ALL plans and days. Renders as a centered modal on desktop and a
 * full-height bottom sheet on mobile, with the log input pinned so logging stays
 * the fast primary action.
 */
export function ExerciseHub({
  exercise,
  unit,
  today,
  initialLifts,
  onClose,
}: {
  exercise: ExerciseDTO | null;
  unit: Unit;
  today: string;
  initialLifts: LiftLogDTO[];
  onClose: () => void;
}) {
  const qc = useQueryClient();
  const desktop = useIsDesktop();
  const ulabel = weightUnitLabel(unit);

  const { data = [] } = useQuery({
    queryKey: LIFT_KEY,
    queryFn: getLiftLogs,
    initialData: initialLifts,
  });

  const key = exercise ? normalize(exercise.exercise) : "";
  const group = React.useMemo(
    () => (exercise ? buildGroup(data, key) : null),
    [data, key, exercise],
  );

  // Log input (pinned footer).
  const [logForm, setLogForm] = React.useState({ weight: "", reps: "" });
  const [logDay, setLogDay] = React.useState(today);
  const [logError, setLogError] = React.useState<string | null>(null);

  // Edit / delete a single lift entry.
  const [editing, setEditing] = React.useState<LiftLogDTO | null>(null);
  const [editForm, setEditForm] = React.useState({ weight: "", reps: "" });
  const [editError, setEditError] = React.useState<string | null>(null);
  const [deleting, setDeleting] = React.useState<LiftLogDTO | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  // Reset the log input each time a different exercise opens. Adjusting state
  // during render (tracking the previous id) is the recommended alternative to a
  // setState-in-effect here.
  const [prevExId, setPrevExId] = React.useState<string | null>(null);
  const exId = exercise?.id ?? null;
  if (exId !== prevExId) {
    setPrevExId(exId);
    if (exId) {
      setLogForm({ weight: "", reps: "" });
      setLogDay(today);
      setLogError(null);
    }
  }

  const logMutation = useMutation({
    mutationFn: async (vars: {
      exerciseId: string;
      exerciseName: string;
      input: { weight: string; reps: string };
      day: string;
    }) => {
      const res = await logLift(vars.exerciseId, vars.input, vars.day);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async (vars) => {
      setLogError(null);
      await qc.cancelQueries({ queryKey: LIFT_KEY });
      const prev = qc.getQueryData<LiftLogDTO[]>(LIFT_KEY) ?? [];
      const optimistic: LiftLogDTO = {
        id: `optimistic-${Date.now()}`,
        exerciseId: vars.exerciseId,
        exerciseName: vars.exerciseName,
        weight: displayToKg(Number(vars.input.weight), unit),
        reps: Number(vars.input.reps) || 0,
        date:
          vars.day === today
            ? new Date().toISOString()
            : `${vars.day}T12:00:00.000Z`,
      };
      qc.setQueryData<LiftLogDTO[]>(LIFT_KEY, [...prev, optimistic]);
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(LIFT_KEY, ctx.prev);
      setLogError(msg(err, "Could not log the lift"));
    },
    // Keep the hub open — the new set flows into the PR/chart/history. Just clear
    // the weight/reps so another set can be logged fast.
    onSuccess: () => setLogForm({ weight: "", reps: "" }),
    onSettled: () => qc.invalidateQueries({ queryKey: LIFT_KEY }),
  });

  const updateMutation = useMutation({
    mutationFn: async (vars: {
      id: string;
      form: { weight: string; reps: string };
    }) => {
      const res = await updateLift(vars.id, vars.form);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async (vars) => {
      setEditError(null);
      await qc.cancelQueries({ queryKey: LIFT_KEY });
      const prev = qc.getQueryData<LiftLogDTO[]>(LIFT_KEY) ?? [];
      qc.setQueryData<LiftLogDTO[]>(
        LIFT_KEY,
        prev.map((l) =>
          l.id === vars.id
            ? {
                ...l,
                weight: displayToKg(Number(vars.form.weight), unit),
                reps: Number(vars.form.reps) || l.reps,
              }
            : l,
        ),
      );
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(LIFT_KEY, ctx.prev);
      setEditError(msg(err, "Could not update the lift"));
    },
    onSuccess: () => setEditing(null),
    onSettled: () => qc.invalidateQueries({ queryKey: LIFT_KEY }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteLift(id);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async (id) => {
      setDeleteError(null);
      await qc.cancelQueries({ queryKey: LIFT_KEY });
      const prev = qc.getQueryData<LiftLogDTO[]>(LIFT_KEY) ?? [];
      qc.setQueryData<LiftLogDTO[]>(
        LIFT_KEY,
        prev.filter((l) => l.id !== id),
      );
      return { prev };
    },
    onError: (err, _v, ctx) => {
      if (ctx?.prev) qc.setQueryData(LIFT_KEY, ctx.prev);
      setDeleteError(msg(err, "Could not delete the lift"));
    },
    onSuccess: () => setDeleting(null),
    onSettled: () => qc.invalidateQueries({ queryKey: LIFT_KEY }),
  });

  function onLogSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!exercise) return;
    if (!logForm.weight.trim()) return setLogError("Enter a weight");
    if (!logForm.reps.trim()) return setLogError("Enter reps");
    logMutation.mutate({
      exerciseId: exercise.id,
      exerciseName: exercise.exercise,
      input: logForm,
      day: logDay,
    });
  }

  function openEdit(l: LiftLogDTO) {
    setEditForm({
      weight: String(kgToDisplay(l.weight, unit)),
      reps: String(l.reps),
    });
    setEditError(null);
    setEditing(l);
  }

  function onEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    if (!editForm.weight.trim()) return setEditError("Enter a weight");
    if (!editForm.reps.trim()) return setEditError("Enter reps");
    updateMutation.mutate({ id: editing.id, form: editForm });
  }

  const pr = group?.pr;

  return (
    <>
      <BaseDialog.Root
        open={exercise !== null}
        onOpenChange={(o) => {
          if (!o) onClose();
        }}
      >
        <BaseDialog.Portal>
          <BaseDialog.Backdrop className="fixed inset-0 z-50 bg-black/60 transition-opacity duration-300 ease-out data-[ending-style]:opacity-0 data-[starting-style]:opacity-0" />
          <BaseDialog.Popup className={desktop ? DESKTOP_POPUP : MOBILE_POPUP}>
            {/* Header — exercise name + PR headline (calendar date) */}
            <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
              <div className="min-w-0">
                <BaseDialog.Title className="truncate font-display text-lg font-semibold tracking-tight">
                  {exercise?.exercise ?? "Exercise"}
                </BaseDialog.Title>
                {pr ? (
                  <div className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <span className="inline-flex items-center gap-1 text-xs font-medium uppercase tracking-wider text-primary">
                      <Trophy className="size-3.5" /> PR
                    </span>
                    <span className="font-display text-xl font-semibold tracking-tight">
                      {kgToDisplay(pr.weight, unit)}
                      <span className="ml-1 text-sm font-normal text-muted-foreground">
                        {ulabel}
                      </span>
                    </span>
                    <span className="text-xs text-muted-foreground">
                      × {pr.reps} · set {shortDate(dayKeyOf(pr.date))}
                    </span>
                  </div>
                ) : (
                  <BaseDialog.Description className="mt-1 text-sm text-muted-foreground">
                    No lifts logged yet — record your first set below.
                  </BaseDialog.Description>
                )}
              </div>
              <BaseDialog.Close
                aria-label="Close"
                className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40"
              >
                <X className="size-4" />
              </BaseDialog.Close>
            </div>

            {/* Scrollable body — progression chart + full history */}
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {group ? (
                <div className="flex flex-col gap-5">
                  <ProgressionChart group={group} unit={unit} />
                  <History
                    group={group}
                    unit={unit}
                    today={today}
                    onEdit={openEdit}
                    onDelete={(l) => {
                      setDeleteError(null);
                      setDeleting(l);
                    }}
                  />
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
                  <span className="flex size-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Dumbbell className="size-6" />
                  </span>
                  <p className="text-sm font-medium">Nothing logged yet</p>
                  <p className="max-w-xs text-sm text-muted-foreground">
                    Log a set below and it&apos;ll start tracking your PR and
                    progression for this exercise across every plan.
                  </p>
                </div>
              )}
            </div>

            {/* Pinned footer — the log input stays reachable, logging-first */}
            <form
              onSubmit={onLogSubmit}
              className="flex shrink-0 flex-col gap-3 border-t border-border bg-secondary/20 px-5 py-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Log a set
                </span>
                <DateNav
                  day={logDay}
                  today={today}
                  onChange={setLogDay}
                  onStep={(n) => setLogDay((d) => addDays(d, n))}
                />
              </div>
              <div className="flex items-end gap-2">
                <div className="flex flex-1 flex-col gap-1.5">
                  <Label htmlFor="hub-weight" className="text-xs">
                    Weight ({ulabel})
                  </Label>
                  <Input
                    id="hub-weight"
                    type="number"
                    inputMode="decimal"
                    step="0.5"
                    min="0"
                    placeholder={ulabel}
                    value={logForm.weight}
                    onChange={(e) =>
                      setLogForm((f) => ({ ...f, weight: e.target.value }))
                    }
                  />
                </div>
                <div className="flex w-20 flex-col gap-1.5">
                  <Label htmlFor="hub-reps" className="text-xs">
                    Reps
                  </Label>
                  <Input
                    id="hub-reps"
                    type="number"
                    inputMode="numeric"
                    step="1"
                    min="1"
                    placeholder="reps"
                    value={logForm.reps}
                    onChange={(e) =>
                      setLogForm((f) => ({ ...f, reps: e.target.value }))
                    }
                  />
                </div>
                <Button
                  type="submit"
                  disabled={logMutation.isPending}
                  className="h-10 px-4"
                >
                  <Dumbbell />
                  {logMutation.isPending ? "Logging…" : "Log"}
                </Button>
              </div>
              {logError ? (
                <p className="text-sm text-destructive" role="alert">
                  {logError}
                </p>
              ) : (
                <p className="text-[0.7rem] text-muted-foreground">
                  Dated to the calendar day you lifted — separate from the plan&apos;s
                  Day 1 / Day 3 split.
                </p>
              )}
            </form>
          </BaseDialog.Popup>
        </BaseDialog.Portal>
      </BaseDialog.Root>

      {/* Edit a lift entry */}
      <Dialog
        open={editing !== null}
        onOpenChange={(o) => {
          if (!o) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="font-display text-lg font-semibold tracking-tight">
            Edit lift
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Update the weight and reps you recorded.
          </DialogDescription>
          <form onSubmit={onEditSubmit} className="mt-4 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-lift-weight">Weight ({ulabel})</Label>
                <Input
                  id="edit-lift-weight"
                  type="number"
                  inputMode="decimal"
                  step="0.5"
                  min="0"
                  value={editForm.weight}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, weight: e.target.value }))
                  }
                  required
                />
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="edit-lift-reps">Reps</Label>
                <Input
                  id="edit-lift-reps"
                  type="number"
                  inputMode="numeric"
                  step="1"
                  min="1"
                  value={editForm.reps}
                  onChange={(e) =>
                    setEditForm((f) => ({ ...f, reps: e.target.value }))
                  }
                  required
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
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
        pending={deleteMutation.isPending}
        error={deleteError}
        description={
          <>
            Remove this{" "}
            {deleting
              ? `${kgToDisplay(deleting.weight, unit)} ${ulabel} × ${deleting.reps}`
              : ""}{" "}
            lift? This can&apos;t be undone.
          </>
        }
      />
    </>
  );
}

function ProgressionChart({
  group,
  unit,
}: {
  group: ExerciseGroup;
  unit: Unit;
}) {
  const ulabel = weightUnitLabel(unit);
  const cdata = chartData(group, unit);

  const ws = cdata.map((d) => d.weight);
  const min = Math.min(...ws);
  const max = Math.max(...ws);
  const pad = Math.max(1, (max - min) * 0.2);
  const domain: [number, number] = [Math.floor(min - pad), Math.ceil(max + pad)];

  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        Progression
      </p>
      <ChartContainer className="h-40">
        <LineChart data={cdata} margin={{ top: 8, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid
            vertical={false}
            stroke={GRID_STROKE}
            strokeDasharray="4 4"
          />
          <XAxis
            dataKey="label"
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            minTickGap={16}
            tickMargin={8}
          />
          <YAxis
            domain={domain}
            tick={AXIS_TICK}
            tickLine={false}
            axisLine={false}
            width={40}
            allowDecimals={false}
          />
          <Tooltip
            cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
            content={<ChartTooltip valueFormatter={(v) => `${v} ${ulabel}`} />}
          />
          <Line
            type="monotone"
            dataKey="weight"
            name="Best set"
            stroke="var(--brand)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--brand)", strokeWidth: 0 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ChartContainer>
    </div>
  );
}

function History({
  group,
  unit,
  today,
  onEdit,
  onDelete,
}: {
  group: ExerciseGroup;
  unit: Unit;
  today: string;
  onEdit: (l: LiftLogDTO) => void;
  onDelete: (l: LiftLogDTO) => void;
}) {
  const ulabel = weightUnitLabel(unit);
  const { pr } = group;

  return (
    <div>
      <p className="mb-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        History
      </p>
      <ul className="flex flex-col">
        {[...group.logs].reverse().map((l) => {
          const pending = l.id.startsWith("optimistic-");
          const isPR = l.id === pr.id;
          return (
            <li
              key={l.id}
              className={cn(
                "flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0",
                pending && "opacity-60",
              )}
            >
              <span className="text-muted-foreground">
                {formatDay(dayKeyOf(l.date), today)}
              </span>
              <span className="flex items-center gap-1.5">
                <span className="font-medium tabular-nums text-foreground">
                  {kgToDisplay(l.weight, unit)} {ulabel} × {l.reps}
                </span>
                {isPR && (
                  <Trophy
                    className="size-3 text-primary"
                    aria-label="Personal record"
                  />
                )}
                {!pending && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-foreground"
                      aria-label="Edit lift"
                      onClick={() => onEdit(l)}
                    >
                      <Pencil />
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive"
                      aria-label="Delete lift"
                      onClick={() => onDelete(l)}
                    >
                      <Trash2 />
                    </Button>
                  </>
                )}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
