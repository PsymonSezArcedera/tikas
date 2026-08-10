"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Dumbbell, Pencil, Plus, Trash2 } from "lucide-react";

import { INTENSITIES, WORKOUT_GOALS } from "@/lib/validations";
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
  type PlanDTO,
} from "./actions";

export const PLAN_KEY = ["workoutPlan"] as const;

const NOTES_CLASS =
  "min-h-16 w-full resize-y rounded-lg border border-input bg-transparent px-3 py-2 text-sm shadow-xs outline-none transition-[color,box-shadow] placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/40 dark:bg-input/30";

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

export function PlanView({ plan }: { plan: PlanDTO }) {
  const qc = useQueryClient();
  const days = groupByDay(plan.exercises);

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
                  return (
                    <li
                      key={e.id}
                      className={cn(
                        "flex items-start justify-between gap-4 border-b border-border py-3 last:border-b-0",
                        pending && "opacity-60",
                      )}
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{e.exercise}</p>
                        {e.notes ? (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {e.notes}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 items-start gap-1">
                        <div className="text-right">
                          <p className="font-display text-sm font-semibold tracking-tight">
                            {e.sets} × {e.reps}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            rest {e.rest}
                          </p>
                        </div>
                        {!pending && (
                          <div className="flex items-center gap-0.5">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-foreground"
                              aria-label={`Edit ${e.exercise}`}
                              onClick={() => openEditEx(e)}
                            >
                              <Pencil />
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon-sm"
                              className="text-muted-foreground hover:text-destructive"
                              aria-label={`Delete ${e.exercise}`}
                              onClick={() => {
                                setConfirmError(null);
                                setDeletingEx(e);
                              }}
                            >
                              <Trash2 />
                            </Button>
                          </div>
                        )}
                      </div>
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
