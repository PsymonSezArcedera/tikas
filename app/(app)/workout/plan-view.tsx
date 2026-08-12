"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Menu } from "@base-ui/react/menu";
import { ChevronRight, Dumbbell, MoreHorizontal, Pencil, Plus, Trash2 } from "lucide-react";

import { INTENSITIES, WORKOUT_GOALS } from "@/lib/validations";
import { type Unit } from "@/lib/units";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ConfirmDialog } from "@/components/confirm-dialog";
import {
  addExercise,
  deleteDay,
  deleteExercise,
  deletePlan,
  updateExercise,
  updatePlanMeta,
  type ExerciseDTO,
  type LiftLogDTO,
  type PlanDTO,
} from "./actions";
import { ExerciseHub } from "./lift-progress";

export const PLAN_KEY = ["workoutPlan"] as const;

const NOTES_CLASS =
  "min-h-16 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 dark:bg-input/30";

const MENU_ITEM =
  "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2.5 py-2 text-sm outline-none select-none data-[highlighted]:bg-muted";

const msg = (e: unknown, fallback: string) =>
  e instanceof Error ? e.message : fallback;

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

/* --------------------------------- Forms --------------------------------- */

type ExForm = {
  exercise: string;
  sets: string;
  reps: string;
  rest: string;
  notes: string;
};
const emptyEx: ExForm = { exercise: "", sets: "3", reps: "", rest: "", notes: "" };

const exToForm = (e: ExerciseDTO): ExForm => ({
  exercise: e.exercise,
  sets: String(e.sets),
  reps: e.reps,
  rest: e.rest,
  notes: e.notes ?? "",
});

// Shared fields for the add/edit exercise dialogs. idPrefix keeps ids unique
// across the two mounted instances.
function ExerciseFields({
  idPrefix,
  form,
  set,
}: {
  idPrefix: string;
  form: ExForm;
  set: (key: keyof ExForm, value: string) => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-exercise`}>Exercise</Label>
        <Input
          id={`${idPrefix}-exercise`}
          placeholder="e.g. Barbell squat"
          value={form.exercise}
          onChange={(e) => set("exercise", e.target.value)}
          required
        />
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-sets`}>Sets</Label>
          <Input
            id={`${idPrefix}-sets`}
            type="number"
            inputMode="numeric"
            step="1"
            min="1"
            max="30"
            value={form.sets}
            onChange={(e) => set("sets", e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-reps`}>Reps</Label>
          <Input
            id={`${idPrefix}-reps`}
            placeholder="8-12"
            value={form.reps}
            onChange={(e) => set("reps", e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-rest`}>Rest</Label>
          <Input
            id={`${idPrefix}-rest`}
            placeholder="90s"
            value={form.rest}
            onChange={(e) => set("rest", e.target.value)}
            required
          />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-notes`}>Notes (optional)</Label>
        <textarea
          id={`${idPrefix}-notes`}
          rows={2}
          placeholder="Tempo, cues, alternatives…"
          className={NOTES_CLASS}
          value={form.notes}
          onChange={(e) => set("notes", e.target.value)}
        />
      </div>
    </>
  );
}

const exFormError = (f: ExForm): string | null => {
  if (!f.exercise.trim()) return "Enter an exercise name";
  if (!f.sets.trim()) return "Enter the number of sets";
  if (!f.reps.trim()) return "Enter reps";
  if (!f.rest.trim()) return "Enter a rest interval";
  return null;
};

/* -------------------------------- PlanView ------------------------------- */

export function PlanView({
  plan,
  unit,
  today,
  initialLifts,
}: {
  plan: PlanDTO;
  unit: Unit;
  today: string;
  initialLifts: LiftLogDTO[];
}) {
  const qc = useQueryClient();
  const days = groupByDay(plan.exercises);

  // The per-exercise hub (PR + progression + history + logging), opened by
  // tapping an exercise row.
  const [hubEx, setHubEx] = React.useState<ExerciseDTO | null>(null);

  // Dialog state.
  const [editMeta, setEditMeta] = React.useState(false);
  const [metaForm, setMetaForm] = React.useState({
    title: plan.title,
    goal: plan.goal,
    intensity: plan.intensity,
    duration: String(plan.duration),
  });
  const [metaError, setMetaError] = React.useState<string | null>(null);

  const [editingEx, setEditingEx] = React.useState<ExerciseDTO | null>(null);
  const [editExForm, setEditExForm] = React.useState(emptyEx);
  const [editExError, setEditExError] = React.useState<string | null>(null);

  const [addingDay, setAddingDay] = React.useState<string | null>(null);
  const [addForm, setAddForm] = React.useState(emptyEx);
  const [addError, setAddError] = React.useState<string | null>(null);

  const [deletingEx, setDeletingEx] = React.useState<ExerciseDTO | null>(null);
  const [deletingDay, setDeletingDay] = React.useState<string | null>(null);
  const [deletingPlan, setDeletingPlan] = React.useState(false);
  const [confirmError, setConfirmError] = React.useState<string | null>(null);

  // Optimistically transform the cached plan. Snapshot + restore on error.
  const patch = (fn: (p: PlanDTO) => PlanDTO) => {
    const prev = qc.getQueryData<PlanDTO | null>(PLAN_KEY);
    qc.setQueryData<PlanDTO | null>(PLAN_KEY, (p) => (p ? fn(p) : p));
    return prev;
  };
  const restore = (prev: PlanDTO | null | undefined) =>
    qc.setQueryData(PLAN_KEY, prev);
  const invalidate = () => qc.invalidateQueries({ queryKey: PLAN_KEY });

  const metaMutation = useMutation({
    mutationFn: async (form: typeof metaForm) => {
      const res = await updatePlanMeta(plan.id, form);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async (form) => {
      setMetaError(null);
      await qc.cancelQueries({ queryKey: PLAN_KEY });
      return {
        prev: patch((p) => ({
          ...p,
          title: form.title.trim() || p.title,
          goal: form.goal,
          intensity: form.intensity,
          duration: Number(form.duration) || p.duration,
        })),
      };
    },
    onError: (err, _v, ctx) => {
      restore(ctx?.prev);
      setMetaError(msg(err, "Could not update the plan"));
    },
    onSuccess: () => setEditMeta(false),
    onSettled: invalidate,
  });

  const updateExMutation = useMutation({
    mutationFn: async (vars: { id: string; form: ExForm }) => {
      const res = await updateExercise(vars.id, vars.form);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async (vars) => {
      setEditExError(null);
      await qc.cancelQueries({ queryKey: PLAN_KEY });
      return {
        prev: patch((p) => ({
          ...p,
          exercises: p.exercises.map((e) =>
            e.id === vars.id
              ? {
                  ...e,
                  exercise: vars.form.exercise,
                  sets: Number(vars.form.sets) || e.sets,
                  reps: vars.form.reps,
                  rest: vars.form.rest,
                  notes: vars.form.notes.trim() || null,
                }
              : e,
          ),
        })),
      };
    },
    onError: (err, _v, ctx) => {
      restore(ctx?.prev);
      setEditExError(msg(err, "Could not update the exercise"));
    },
    onSuccess: () => setEditingEx(null),
    onSettled: invalidate,
  });

  const addExMutation = useMutation({
    mutationFn: async (vars: { day: string; form: ExForm }) => {
      const res = await addExercise(plan.id, { day: vars.day, ...vars.form });
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async (vars) => {
      setAddError(null);
      await qc.cancelQueries({ queryKey: PLAN_KEY });
      const optimistic: ExerciseDTO = {
        id: `optimistic-${Date.now()}`,
        day: vars.day,
        exercise: vars.form.exercise,
        sets: Number(vars.form.sets) || 0,
        reps: vars.form.reps,
        rest: vars.form.rest,
        notes: vars.form.notes.trim() || null,
      };
      return {
        prev: patch((p) => ({ ...p, exercises: [...p.exercises, optimistic] })),
      };
    },
    onError: (err, _v, ctx) => {
      restore(ctx?.prev);
      setAddError(msg(err, "Could not add the exercise"));
    },
    onSuccess: () => setAddingDay(null),
    onSettled: invalidate,
  });

  const deleteExMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await deleteExercise(id);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async (id) => {
      setConfirmError(null);
      await qc.cancelQueries({ queryKey: PLAN_KEY });
      return {
        prev: patch((p) => ({
          ...p,
          exercises: p.exercises.filter((e) => e.id !== id),
        })),
      };
    },
    onError: (err, _v, ctx) => {
      restore(ctx?.prev);
      setConfirmError(msg(err, "Could not delete the exercise"));
    },
    onSuccess: () => setDeletingEx(null),
    onSettled: invalidate,
  });

  const deleteDayMutation = useMutation({
    mutationFn: async (day: string) => {
      const res = await deleteDay(plan.id, day);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async (day) => {
      setConfirmError(null);
      await qc.cancelQueries({ queryKey: PLAN_KEY });
      return {
        prev: patch((p) => {
          const exercises = p.exercises.filter((e) => e.day !== day);
          return {
            ...p,
            exercises,
            days: new Set(exercises.map((e) => e.day)).size,
          };
        }),
      };
    },
    onError: (err, _v, ctx) => {
      restore(ctx?.prev);
      setConfirmError(msg(err, "Could not delete the day"));
    },
    onSuccess: () => setDeletingDay(null),
    onSettled: invalidate,
  });

  const deletePlanMutation = useMutation({
    mutationFn: async () => {
      const res = await deletePlan(plan.id);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async () => {
      setConfirmError(null);
      await qc.cancelQueries({ queryKey: PLAN_KEY });
      const prev = qc.getQueryData<PlanDTO | null>(PLAN_KEY);
      qc.setQueryData<PlanDTO | null>(PLAN_KEY, null);
      return { prev };
    },
    onError: (err, _v, ctx) => {
      restore(ctx?.prev);
      setConfirmError(msg(err, "Could not delete the plan"));
    },
    onSuccess: () => setDeletingPlan(false),
    onSettled: invalidate,
  });

  function openEditMeta() {
    setMetaForm({
      title: plan.title,
      goal: plan.goal,
      intensity: plan.intensity,
      duration: String(plan.duration),
    });
    setMetaError(null);
    setEditMeta(true);
  }

  function openEditEx(e: ExerciseDTO) {
    setEditExForm(exToForm(e));
    setEditExError(null);
    setEditingEx(e);
  }

  function openAdd(day: string) {
    setAddForm(emptyEx);
    setAddError(null);
    setAddingDay(day);
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2 text-primary">
            <Dumbbell className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider">
              Your plan
            </span>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8"
              onClick={openEditMeta}
            >
              <Pencil />
              Edit
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              className="text-muted-foreground hover:text-destructive"
              aria-label="Delete plan"
              onClick={() => {
                setConfirmError(null);
                setDeletingPlan(true);
              }}
            >
              <Trash2 />
            </Button>
          </div>
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
        {days.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            This plan has no exercises. Add one to a day, or delete the plan.
          </p>
        ) : (
          days.map(([day, exercises]) => (
            <section key={day} className="flex flex-col gap-1">
              <div className="flex items-center justify-between gap-2 border-b border-border pb-2">
                <h3 className="font-display text-sm font-semibold uppercase tracking-wide">
                  {day}
                </h3>
                <div className="flex items-center gap-0.5">
                  <span className="mr-1 text-xs text-muted-foreground">
                    {exercises.length}{" "}
                    {exercises.length === 1 ? "exercise" : "exercises"}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-foreground"
                    aria-label={`Add exercise to ${day}`}
                    onClick={() => openAdd(day)}
                  >
                    <Plus />
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="text-muted-foreground hover:text-destructive"
                    aria-label={`Delete ${day}`}
                    onClick={() => {
                      setConfirmError(null);
                      setDeletingDay(day);
                    }}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
              <ul className="flex flex-col">
                {exercises.map((e) => {
                  const pending = e.id.startsWith("optimistic-");
                  const stats = (
                    <div className="shrink-0 text-right">
                      <p className="font-display text-sm font-semibold tracking-tight">
                        {e.sets} × {e.reps}
                      </p>
                      <p className="text-xs text-muted-foreground">rest {e.rest}</p>
                    </div>
                  );
                  const info = (
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{e.exercise}</p>
                      {e.notes ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {e.notes}
                        </p>
                      ) : null}
                    </div>
                  );
                  return (
                    <li
                      key={e.id}
                      className={cn(
                        "border-b border-border last:border-b-0",
                        pending && "opacity-60",
                      )}
                    >
                      {pending ? (
                        <div className="flex items-center gap-3 px-1 py-3">
                          {info}
                          {stats}
                        </div>
                      ) : (
                        // The whole row opens the per-exercise hub. Overflow menu
                        // (edit/delete) stops propagation so it doesn't also open it.
                        <div
                          role="button"
                          tabIndex={0}
                          aria-label={`Open ${e.exercise}`}
                          onClick={() => setHubEx(e)}
                          onKeyDown={(ev) => {
                            if (ev.key === "Enter" || ev.key === " ") {
                              ev.preventDefault();
                              setHubEx(e);
                            }
                          }}
                          className="group flex cursor-pointer items-center gap-3 rounded-xl px-2 py-3 text-left transition-colors hover:bg-secondary/60 focus-visible:bg-secondary/60 focus-visible:outline-none"
                        >
                          {info}
                          {stats}
                          <Menu.Root>
                            <Menu.Trigger
                              aria-label={`Actions for ${e.exercise}`}
                              onClick={(ev) => ev.stopPropagation()}
                              onPointerDown={(ev) => ev.stopPropagation()}
                              className="flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-3 focus-visible:ring-ring/40 aria-expanded:bg-muted aria-expanded:text-foreground"
                            >
                              <MoreHorizontal className="size-4" />
                            </Menu.Trigger>
                            <Menu.Portal>
                              <Menu.Positioner
                                align="end"
                                sideOffset={6}
                                className="z-50"
                              >
                                <Menu.Popup className="min-w-36 rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none">
                                  <Menu.Item
                                    className={MENU_ITEM}
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      openEditEx(e);
                                    }}
                                  >
                                    <Pencil className="size-4" />
                                    Edit
                                  </Menu.Item>
                                  <Menu.Item
                                    className={cn(
                                      MENU_ITEM,
                                      "text-destructive data-[highlighted]:bg-destructive/10 data-[highlighted]:text-destructive",
                                    )}
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      setConfirmError(null);
                                      setDeletingEx(e);
                                    }}
                                  >
                                    <Trash2 className="size-4" />
                                    Delete
                                  </Menu.Item>
                                </Menu.Popup>
                              </Menu.Positioner>
                            </Menu.Portal>
                          </Menu.Root>
                          <ChevronRight className="size-4 shrink-0 text-muted-foreground/50 transition-transform group-hover:translate-x-0.5" />
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
      </CardContent>

      {/* Edit plan metadata */}
      <Dialog
        open={editMeta}
        onOpenChange={(o) => {
          if (!o) setEditMeta(false);
        }}
      >
        <DialogContent>
          <DialogTitle className="font-display text-lg font-semibold tracking-tight">
            Edit plan
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Update the plan&apos;s title and targets.
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!metaForm.title.trim()) return setMetaError("Enter a title");
              metaMutation.mutate(metaForm);
            }}
            className="mt-4 flex flex-col gap-4"
          >
            <div className="flex flex-col gap-2">
              <Label htmlFor="meta-title">Title</Label>
              <Input
                id="meta-title"
                value={metaForm.title}
                onChange={(e) =>
                  setMetaForm((f) => ({ ...f, title: e.target.value }))
                }
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="flex flex-col gap-2">
                <Label htmlFor="meta-goal">Goal</Label>
                <Select
                  id="meta-goal"
                  value={metaForm.goal}
                  onChange={(e) =>
                    setMetaForm((f) => ({ ...f, goal: e.target.value }))
                  }
                >
                  {WORKOUT_GOALS.map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="flex flex-col gap-2">
                <Label htmlFor="meta-intensity">Intensity</Label>
                <Select
                  id="meta-intensity"
                  value={metaForm.intensity}
                  onChange={(e) =>
                    setMetaForm((f) => ({ ...f, intensity: e.target.value }))
                  }
                >
                  {INTENSITIES.map((i) => (
                    <option key={i} value={i}>
                      {i}
                    </option>
                  ))}
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="meta-duration">Minutes / session</Label>
              <Input
                id="meta-duration"
                type="number"
                inputMode="numeric"
                step="5"
                min="15"
                max="180"
                value={metaForm.duration}
                onChange={(e) =>
                  setMetaForm((f) => ({ ...f, duration: e.target.value }))
                }
                required
              />
            </div>

            {metaError && (
              <p className="text-sm text-destructive" role="alert">
                {metaError}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={metaMutation.isPending}
                className="h-10 flex-1"
              >
                {metaMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => setEditMeta(false)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit exercise */}
      <Dialog
        open={editingEx !== null}
        onOpenChange={(o) => {
          if (!o) setEditingEx(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="font-display text-lg font-semibold tracking-tight">
            Edit exercise
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Update the exercise and save.
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editingEx) return;
              const err = exFormError(editExForm);
              if (err) return setEditExError(err);
              updateExMutation.mutate({ id: editingEx.id, form: editExForm });
            }}
            className="mt-4 flex flex-col gap-4"
          >
            <ExerciseFields
              idPrefix="edit"
              form={editExForm}
              set={(key, value) =>
                setEditExForm((f) => ({ ...f, [key]: value }))
              }
            />

            {editExError && (
              <p className="text-sm text-destructive" role="alert">
                {editExError}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={updateExMutation.isPending}
                className="h-10 flex-1"
              >
                {updateExMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => setEditingEx(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Add exercise */}
      <Dialog
        open={addingDay !== null}
        onOpenChange={(o) => {
          if (!o) setAddingDay(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="font-display text-lg font-semibold tracking-tight">
            Add exercise
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Adding to {addingDay}.
          </DialogDescription>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (addingDay === null) return;
              const err = exFormError(addForm);
              if (err) return setAddError(err);
              addExMutation.mutate({ day: addingDay, form: addForm });
            }}
            className="mt-4 flex flex-col gap-4"
          >
            <ExerciseFields
              idPrefix="add"
              form={addForm}
              set={(key, value) => setAddForm((f) => ({ ...f, [key]: value }))}
            />

            {addError && (
              <p className="text-sm text-destructive" role="alert">
                {addError}
              </p>
            )}

            <div className="flex gap-2">
              <Button
                type="submit"
                disabled={addExMutation.isPending}
                className="h-10 flex-1"
              >
                {addExMutation.isPending ? "Adding…" : "Add exercise"}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="h-10"
                onClick={() => setAddingDay(null)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Per-exercise hub — PR, progression, history, and logging */}
      <ExerciseHub
        exercise={hubEx}
        unit={unit}
        today={today}
        initialLifts={initialLifts}
        onClose={() => setHubEx(null)}
      />

      {/* Confirms */}
      <ConfirmDialog
        open={deletingEx !== null}
        onClose={() => setDeletingEx(null)}
        onConfirm={() => deletingEx && deleteExMutation.mutate(deletingEx.id)}
        pending={deleteExMutation.isPending}
        error={confirmError}
        title="Delete exercise?"
        description={
          <>
            Remove{" "}
            {deletingEx ? `“${deletingEx.exercise}”` : "this exercise"} from the
            plan? This can&apos;t be undone.
          </>
        }
      />

      <ConfirmDialog
        open={deletingDay !== null}
        onClose={() => setDeletingDay(null)}
        onConfirm={() => deletingDay && deleteDayMutation.mutate(deletingDay)}
        pending={deleteDayMutation.isPending}
        error={confirmError}
        title="Delete day?"
        description={
          <>
            Remove {deletingDay} and all its exercises? This can&apos;t be undone.
          </>
        }
      />

      <ConfirmDialog
        open={deletingPlan}
        onClose={() => setDeletingPlan(false)}
        onConfirm={() => deletePlanMutation.mutate()}
        pending={deletePlanMutation.isPending}
        error={confirmError}
        title="Delete plan?"
        description={
          <>
            Delete &ldquo;{plan.title}&rdquo; and all its exercises? This
            can&apos;t be undone.
          </>
        }
      />
    </Card>
  );
}
