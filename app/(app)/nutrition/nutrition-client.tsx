"use client";

import * as React from "react";
import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Flame,
  Loader2,
  Pencil,
  Salad,
  Search,
  Trash2,
  UtensilsCrossed,
} from "lucide-react";

import { cn } from "@/lib/utils";
import { addDays } from "@/lib/day";
import { Button } from "@/components/ui/button";
import { DateNav, formatDay } from "@/components/date-nav";
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
import { Select } from "@/components/ui/select";
import {
  createFoodLog,
  deleteFoodLog,
  getFoodLogsForDay,
  searchFoodProducts,
  updateFoodLog,
  type FoodLogDTO,
  type FoodLogInputRaw,
  type FoodSearchResultDTO,
  type MealType,
} from "./actions";

// Per-day cache key. A broad ["foodLogs"] invalidation still matches every day's
// query (partial match), so mutations refresh all cached days at once.
const dayKey = (day: string) => ["foodLogs", day] as const;

const MEALS: { value: MealType; label: string }[] = [
  { value: "BREAKFAST", label: "Breakfast" },
  { value: "LUNCH", label: "Lunch" },
  { value: "DINNER", label: "Dinner" },
  { value: "SNACK", label: "Snack" },
];

const SERVING_UNITS = ["g", "ml", "piece", "cup", "serving", "oz", "tbsp", "slice"];

const segmentItem =
  "flex cursor-pointer items-center justify-center rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground";
const segmentItemActive = "bg-background text-foreground shadow-sm";

const round = (n: number) => Math.round(n);
const round1 = (n: number) => Math.round(n * 10) / 10;

const emptyForm = {
  foodName: "",
  quantity: "1",
  servingSize: "",
  servingUnit: "g",
  calories: "",
  protein: "",
  carbs: "",
  fat: "",
};

type FoodFormState = typeof emptyForm;

// Field-level validation shared by the log form and the edit dialog — same rules,
// so both refuse the same bad input before hitting the Server Action / Zod.
function formError(form: FoodFormState): string | null {
  if (!form.foodName.trim()) return "Enter a food name";
  if (!form.quantity.trim() || !form.servingSize.trim())
    return "Enter quantity and serving size";
  if (!form.calories.trim()) return "Enter calories";
  return null;
}

const toForm = (f: FoodLogDTO): FoodFormState => ({
  foodName: f.foodName,
  quantity: String(f.quantity),
  servingSize: String(f.servingSize),
  servingUnit: f.servingUnit,
  calories: String(f.calories),
  protein: String(f.protein),
  carbs: String(f.carbs),
  fat: String(f.fat),
});

// A raw form + meal, shaped for the optimistic cache entry (numbers coerced the
// same way the Server Action will).
const optimisticFrom = (
  id: string,
  meal: MealType,
  form: FoodFormState,
  date: string,
): FoodLogDTO => ({
  id,
  mealType: meal,
  foodName: form.foodName,
  quantity: Number(form.quantity),
  servingSize: Number(form.servingSize),
  servingUnit: form.servingUnit,
  calories: Number(form.calories) || 0,
  protein: Number(form.protein) || 0,
  carbs: Number(form.carbs) || 0,
  fat: Number(form.fat) || 0,
  date,
});

export function NutritionClient({
  initialLogs,
  today,
}: {
  initialLogs: FoodLogDTO[];
  today: string;
}) {
  const qc = useQueryClient();
  const [meal, setMeal] = React.useState<MealType>("BREAKFAST");
  const [form, setForm] = React.useState(emptyForm);
  const [error, setError] = React.useState<string | null>(null);

  // Which app-day the page is showing. Defaults to today; never goes past it.
  const [day, setDay] = React.useState(today);
  const isToday = day === today;

  // Edit dialog state.
  const [editing, setEditing] = React.useState<FoodLogDTO | null>(null);
  const [editMeal, setEditMeal] = React.useState<MealType>("BREAKFAST");
  const [editForm, setEditForm] = React.useState(emptyForm);
  const [editError, setEditError] = React.useState<string | null>(null);

  // Delete-confirm dialog state.
  const [deleting, setDeleting] = React.useState<FoodLogDTO | null>(null);
  const [deleteError, setDeleteError] = React.useState<string | null>(null);

  const { data = [], isPlaceholderData } = useQuery({
    queryKey: dayKey(day),
    queryFn: () => getFoodLogsForDay(day),
    // Seed only today's query with the server-rendered logs; other days fetch.
    initialData: isToday ? initialLogs : undefined,
    // Keep the previous day's list on screen (dimmed) while the new one loads,
    // so switching days doesn't flash empty.
    placeholderData: keepPreviousData,
  });

  const createMutation = useMutation({
    mutationFn: async (vars: { input: FoodLogInputRaw; day: string }) => {
      const res = await createFoodLog(vars.input, vars.day);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async (vars) => {
      setError(null);
      const key = dayKey(vars.day);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<FoodLogDTO[]>(key) ?? [];
      const optimistic = optimisticFrom(
        `optimistic-${Date.now()}`,
        vars.input.mealType as MealType,
        vars.input,
        vars.day === today
          ? new Date().toISOString()
          : `${vars.day}T12:00:00.000Z`,
      );
      qc.setQueryData<FoodLogDTO[]>(key, [optimistic, ...prev]);
      return { prev, key };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      setError(err instanceof Error ? err.message : "Could not save entry");
    },
    onSuccess: () => setForm(emptyForm),
    onSettled: () => qc.invalidateQueries({ queryKey: ["foodLogs"] }),
  });

  const updateMutation = useMutation({
    mutationFn: async (vars: {
      id: string;
      input: FoodLogInputRaw;
      day: string;
    }) => {
      const res = await updateFoodLog(vars.id, vars.input);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async (vars) => {
      setEditError(null);
      const key = dayKey(vars.day);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<FoodLogDTO[]>(key) ?? [];
      const patched = optimisticFrom(
        vars.id,
        vars.input.mealType as MealType,
        vars.input,
        editing?.date ?? new Date().toISOString(),
      );
      qc.setQueryData<FoodLogDTO[]>(
        key,
        prev.map((f) => (f.id === vars.id ? patched : f)),
      );
      return { prev, key };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      setEditError(err instanceof Error ? err.message : "Could not update entry");
    },
    onSuccess: () => setEditing(null),
    onSettled: () => qc.invalidateQueries({ queryKey: ["foodLogs"] }),
  });

  const deleteMutation = useMutation({
    mutationFn: async (vars: { id: string; day: string }) => {
      const res = await deleteFoodLog(vars.id);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async (vars) => {
      setDeleteError(null);
      const key = dayKey(vars.day);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<FoodLogDTO[]>(key) ?? [];
      qc.setQueryData<FoodLogDTO[]>(
        key,
        prev.filter((f) => f.id !== vars.id),
      );
      return { prev, key };
    },
    onError: (err, _vars, ctx) => {
      if (ctx) qc.setQueryData(ctx.key, ctx.prev);
      setDeleteError(err instanceof Error ? err.message : "Could not delete entry");
    },
    onSuccess: () => setDeleting(null),
    onSettled: () => qc.invalidateQueries({ queryKey: ["foodLogs"] }),
  });

  const setCreate = (key: keyof FoodFormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const setEdit = (key: keyof FoodFormState, value: string) =>
    setEditForm((f) => ({ ...f, [key]: value }));

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const err = formError(form);
    if (err) return setError(err);
    createMutation.mutate({ input: { mealType: meal, ...form }, day });
  }

  // Picking an Open Food Facts result fills the form from real per-100g data:
  // serving defaults to 100 g, quantity to 1. Everything stays editable before
  // saving, so the user can adjust to what they actually ate.
  function onPickFood(r: FoodSearchResultDTO) {
    setForm({
      foodName: r.name,
      quantity: "1",
      servingSize: "100",
      servingUnit: "g",
      calories: String(round(r.calories)),
      protein: String(round1(r.protein)),
      carbs: String(round1(r.carbs)),
      fat: String(round1(r.fat)),
    });
    setError(null);
  }

  function openEdit(f: FoodLogDTO) {
    setEditMeal(f.mealType);
    setEditForm(toForm(f));
    setEditError(null);
    setEditing(f);
  }

  function onEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;
    const err = formError(editForm);
    if (err) return setEditError(err);
    updateMutation.mutate({
      id: editing.id,
      input: { mealType: editMeal, ...editForm },
      day,
    });
  }

  function askDelete(f: FoodLogDTO) {
    setDeleteError(null);
    setDeleting(f);
  }

  const totals = data.reduce(
    (acc, f) => ({
      calories: acc.calories + f.calories,
      protein: acc.protein + f.protein,
      carbs: acc.carbs + f.carbs,
      fat: acc.fat + f.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 },
  );

  return (
    <div className="flex flex-col gap-6">
      <header className="flex items-start gap-4">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Salad className="size-5" />
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Nutrition
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Log meals manually and track your calories and macros for the day.
          </p>
        </div>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Log form */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <UtensilsCrossed className="size-4 text-primary" />
              <CardTitle>Log food</CardTitle>
            </div>
            <CardDescription>
              Enter calories and macros for the amount you ate.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={onSubmit} className="flex flex-col gap-4">
              <FoodSearch onPick={onPickFood} />

              <FoodFields
                idPrefix="log"
                meal={meal}
                setMeal={setMeal}
                form={form}
                set={setCreate}
              />

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

              <Button
                type="submit"
                disabled={createMutation.isPending}
                className="h-10"
              >
                {createMutation.isPending
                  ? "Saving…"
                  : isToday
                    ? "Log food"
                    : `Log to ${formatDay(day, today)}`}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Selected-day summary */}
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <CardTitle>{formatDay(day, today)}</CardTitle>
              <DateNav
                day={day}
                today={today}
                onChange={setDay}
                onStep={(n) => setDay((d) => addDays(d, n))}
              />
            </div>
            <CardDescription>
              {data.length === 0
                ? isToday
                  ? "Nothing logged yet."
                  : "No food logged on this day."
                : `${data.length} ${data.length === 1 ? "entry" : "entries"} logged.`}
            </CardDescription>
          </CardHeader>
          <CardContent
            className={cn(
              "flex flex-col gap-5 transition-opacity",
              isPlaceholderData && "opacity-50",
            )}
          >
            <DailyTotals totals={totals} />
            <MealBreakdown logs={data} onEdit={openEdit} onDelete={askDelete} />
          </CardContent>
        </Card>
      </div>

      {/* Edit entry — same fields as the log form, pre-filled. */}
      <Dialog
        open={editing !== null}
        onOpenChange={(open) => {
          if (!open) setEditing(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="font-display text-lg font-semibold tracking-tight">
            Edit entry
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Update the details and save — your daily totals update instantly.
          </DialogDescription>
          <form onSubmit={onEditSubmit} className="mt-4 flex flex-col gap-4">
            <FoodFields
              idPrefix="edit"
              meal={editMeal}
              setMeal={setEditMeal}
              form={editForm}
              set={setEdit}
            />

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

      {/* Delete confirm — small, on-brand, not a browser confirm(). */}
      <Dialog
        open={deleting !== null}
        onOpenChange={(open) => {
          if (!open) setDeleting(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogTitle className="font-display text-lg font-semibold tracking-tight">
            Delete entry?
          </DialogTitle>
          <DialogDescription className="mt-1 text-sm text-muted-foreground">
            Remove {deleting ? `“${deleting.foodName}”` : "this entry"} from
            today&apos;s log? This can&apos;t be undone.
          </DialogDescription>

          {deleteError && (
            <p className="mt-3 text-sm text-destructive" role="alert">
              {deleteError}
            </p>
          )}

          <div className="mt-5 flex justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-9"
              onClick={() => setDeleting(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              className="h-9"
              disabled={deleteMutation.isPending}
              onClick={() =>
                deleting && deleteMutation.mutate({ id: deleting.id, day })
              }
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Open Food Facts search box for the log form. Type a food name → real, sourced
// products from OFF → pick one to auto-fill the fields below (per 100 g, still
// editable). Manual entry is always available as the fallback: this just seeds
// the form, it doesn't gate submission. Fetching happens server-side (Server
// Action) so the User-Agent and caching stay controlled.
function FoodSearch({ onPick }: { onPick: (r: FoodSearchResultDTO) => void }) {
  const [query, setQuery] = React.useState("");
  const [results, setResults] = React.useState<FoodSearchResultDTO[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [open, setOpen] = React.useState(false);
  // Guards against out-of-order responses: only the latest request wins.
  const reqId = React.useRef(0);
  const boxRef = React.useRef<HTMLDivElement>(null);

  // Debounced search as the user types. All state updates live inside the timer
  // callback (not the effect body) so the debounce is honored and there's no
  // synchronous setState-in-effect. <2 chars clears immediately; a query runs
  // after 350ms. `reqId` drops any response the user has already typed past.
  React.useEffect(() => {
    const q = query.trim();
    const id = ++reqId.current;
    const t = setTimeout(
      async () => {
        if (q.length < 2) {
          setResults([]);
          setLoading(false);
          setError(null);
          return;
        }
        setLoading(true);
        const res = await searchFoodProducts(q);
        if (id !== reqId.current) return; // a newer keystroke superseded this one
        setLoading(false);
        if (res.ok) {
          setResults(res.data);
          setError(null);
        } else {
          setResults([]);
          setError(res.error);
        }
      },
      q.length < 2 ? 0 : 350,
    );
    return () => clearTimeout(t);
  }, [query]);

  // Dismiss the dropdown when clicking outside the search box.
  React.useEffect(() => {
    function onDocDown(e: MouseEvent) {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocDown);
    return () => document.removeEventListener("mousedown", onDocDown);
  }, []);

  function pick(r: FoodSearchResultDTO) {
    onPick(r);
    setQuery("");
    setResults([]);
    setError(null);
    setOpen(false);
  }

  const q = query.trim();
  const showDropdown = open && q.length >= 2;

  return (
    <div className="flex flex-col gap-2" ref={boxRef}>
      <Label htmlFor="food-search">Search food database</Label>
      <div className="relative">
        <span className="pointer-events-none absolute inset-y-0 left-3 flex items-center text-muted-foreground">
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Search className="size-4" />
          )}
        </span>
        <Input
          id="food-search"
          type="search"
          autoComplete="off"
          placeholder="e.g. Nutella, Greek yogurt, banana"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          className="pl-9"
        />

        {showDropdown && (
          <div className="absolute z-20 mt-1 w-full overflow-hidden rounded-xl border border-border bg-popover shadow-lg">
            <ul className="max-h-72 overflow-y-auto py-1">
              {error ? (
                <li className="px-3 py-2.5 text-sm text-destructive">{error}</li>
              ) : results.length === 0 ? (
                <li className="px-3 py-2.5 text-sm text-muted-foreground">
                  {loading ? "Searching…" : "No matches — enter it manually below."}
                </li>
              ) : (
                results.map((r) => (
                  <li key={r.code}>
                    <button
                      type="button"
                      onClick={() => pick(r)}
                      className="flex w-full flex-col gap-0.5 px-3 py-2.5 text-left transition-colors hover:bg-secondary focus-visible:bg-secondary focus-visible:outline-none"
                    >
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="min-w-0 truncate text-sm font-medium text-foreground">
                          {r.name}
                        </span>
                        <span className="shrink-0 text-xs font-medium tabular-nums text-foreground">
                          {round(r.calories)} kcal
                        </span>
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {r.brand ? `${r.brand} · ` : ""}per 100 g · P
                        {round(r.protein)} C{round(r.carbs)} F{round(r.fat)}
                      </span>
                    </button>
                  </li>
                ))
              )}
            </ul>
            <p className="border-t border-border px-3 py-1.5 text-[11px] text-muted-foreground">
              Data from Open Food Facts. Picking fills the fields below — edit
              before saving.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Shared food fields: meal segmented control, food name, quantity/serving/unit,
// and calories + macros. `idPrefix` keeps input ids unique across the two mounted
// instances (log form + edit dialog).
function FoodFields({
  idPrefix,
  meal,
  setMeal,
  form,
  set,
}: {
  idPrefix: string;
  meal: MealType;
  setMeal: (m: MealType) => void;
  form: FoodFormState;
  set: (key: keyof FoodFormState, value: string) => void;
}) {
  return (
    <>
      <div className="flex flex-col gap-2">
        <Label>Meal</Label>
        <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-secondary/40 p-1 sm:grid-cols-4">
          {MEALS.map((m) => (
            <button
              key={m.value}
              type="button"
              onClick={() => setMeal(m.value)}
              aria-pressed={meal === m.value}
              className={cn(segmentItem, meal === m.value && segmentItemActive)}
            >
              {m.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor={`${idPrefix}-foodName`}>Food</Label>
        <Input
          id={`${idPrefix}-foodName`}
          placeholder="e.g. Grilled chicken breast"
          value={form.foodName}
          onChange={(e) => set("foodName", e.target.value)}
          required
        />
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-quantity`}>Qty</Label>
          <Input
            id={`${idPrefix}-quantity`}
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0.1"
            placeholder="servings"
            value={form.quantity}
            onChange={(e) => set("quantity", e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-servingSize`}>Serving</Label>
          <Input
            id={`${idPrefix}-servingSize`}
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0.1"
            placeholder="size"
            value={form.servingSize}
            onChange={(e) => set("servingSize", e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-servingUnit`}>Unit</Label>
          <Select
            id={`${idPrefix}-servingUnit`}
            value={form.servingUnit}
            onChange={(e) => set("servingUnit", e.target.value)}
          >
            {SERVING_UNITS.map((u) => (
              <option key={u} value={u}>
                {u}
              </option>
            ))}
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-calories`}>Calories</Label>
          <Input
            id={`${idPrefix}-calories`}
            type="number"
            inputMode="decimal"
            step="1"
            min="0"
            placeholder="kcal"
            value={form.calories}
            onChange={(e) => set("calories", e.target.value)}
            required
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-protein`}>Protein</Label>
          <Input
            id={`${idPrefix}-protein`}
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            placeholder="g"
            value={form.protein}
            onChange={(e) => set("protein", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-carbs`}>Carbs</Label>
          <Input
            id={`${idPrefix}-carbs`}
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            placeholder="g"
            value={form.carbs}
            onChange={(e) => set("carbs", e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor={`${idPrefix}-fat`}>Fat</Label>
          <Input
            id={`${idPrefix}-fat`}
            type="number"
            inputMode="decimal"
            step="0.1"
            min="0"
            placeholder="g"
            value={form.fat}
            onChange={(e) => set("fat", e.target.value)}
          />
        </div>
      </div>
    </>
  );
}

function DailyTotals({
  totals,
}: {
  totals: { calories: number; protein: number; carbs: number; fat: number };
}) {
  return (
    <div className="rounded-xl border border-border bg-secondary/30 p-4">
      <div className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        <Flame className="size-3.5 text-primary" />
        Calories
      </div>
      <p className="mt-1 font-display text-4xl font-semibold tracking-tight">
        {round(totals.calories)}
        <span className="ml-1.5 text-base font-normal text-muted-foreground">
          kcal
        </span>
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <MacroStat label="Protein" grams={totals.protein} />
        <MacroStat label="Carbs" grams={totals.carbs} />
        <MacroStat label="Fat" grams={totals.fat} />
      </div>
    </div>
  );
}

function MacroStat({ label, grams }: { label: string; grams: number }) {
  return (
    <div className="rounded-lg bg-background/60 px-3 py-2">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-lg font-semibold tracking-tight">
        {round(grams)}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">g</span>
      </p>
    </div>
  );
}

function MealBreakdown({
  logs,
  onEdit,
  onDelete,
}: {
  logs: FoodLogDTO[];
  onEdit: (f: FoodLogDTO) => void;
  onDelete: (f: FoodLogDTO) => void;
}) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No food logged on this day.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {MEALS.map((m) => {
        const items = logs.filter((l) => l.mealType === m.value);
        if (items.length === 0) return null;
        const subtotal = items.reduce((s, i) => s + i.calories, 0);
        return (
          <div key={m.value} className="flex flex-col gap-1">
            <div className="flex items-baseline justify-between">
              <h3 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {m.label}
              </h3>
              <span className="text-xs text-muted-foreground">
                {round(subtotal)} kcal
              </span>
            </div>
            <ul className="flex flex-col">
              {items.map((f) => {
                // Optimistic (not-yet-persisted) rows have no real id to act on.
                const pending = f.id.startsWith("optimistic-");
                return (
                  <li
                    key={f.id}
                    className={cn(
                      "group flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0",
                      pending && "opacity-60",
                    )}
                  >
                    <span className="min-w-0">
                      <span className="font-medium text-foreground">
                        {f.foodName}
                      </span>
                      <span className="block text-xs text-muted-foreground">
                        {f.quantity} × {f.servingSize} {f.servingUnit}
                        {f.protein + f.carbs + f.fat > 0 &&
                          ` · P${round(f.protein)} C${round(f.carbs)} F${round(f.fat)}`}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-0.5">
                      <span className="mr-1 font-medium text-foreground tabular-nums">
                        {round(f.calories)} kcal
                      </span>
                      {!pending && (
                        <>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-foreground"
                            aria-label={`Edit ${f.foodName}`}
                            onClick={() => onEdit(f)}
                          >
                            <Pencil />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="text-muted-foreground hover:text-destructive"
                            aria-label={`Delete ${f.foodName}`}
                            onClick={() => onDelete(f)}
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
      })}
    </div>
  );
}
