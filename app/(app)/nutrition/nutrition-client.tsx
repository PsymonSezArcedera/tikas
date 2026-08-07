"use client";

import * as React from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Flame, Salad, UtensilsCrossed } from "lucide-react";

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
import { Select } from "@/components/ui/select";
import {
  createFoodLog,
  getTodayFoodLogs,
  type FoodLogDTO,
  type FoodLogInputRaw,
  type MealType,
} from "./actions";

const FOOD_KEY = ["foodLogs"] as const;

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

export function NutritionClient({
  initialLogs,
}: {
  initialLogs: FoodLogDTO[];
}) {
  const qc = useQueryClient();
  const [meal, setMeal] = React.useState<MealType>("BREAKFAST");
  const [form, setForm] = React.useState(emptyForm);
  const [error, setError] = React.useState<string | null>(null);

  const { data = [] } = useQuery({
    queryKey: FOOD_KEY,
    queryFn: getTodayFoodLogs,
    initialData: initialLogs,
  });

  const mutation = useMutation({
    mutationFn: async (input: FoodLogInputRaw) => {
      const res = await createFoodLog(input);
      if (!res.ok) throw new Error(res.error);
      return res.data;
    },
    onMutate: async (input) => {
      setError(null);
      await qc.cancelQueries({ queryKey: FOOD_KEY });
      const prev = qc.getQueryData<FoodLogDTO[]>(FOOD_KEY) ?? [];
      const optimistic: FoodLogDTO = {
        id: `optimistic-${Date.now()}`,
        mealType: input.mealType as MealType,
        foodName: input.foodName,
        quantity: Number(input.quantity),
        servingSize: Number(input.servingSize),
        servingUnit: input.servingUnit,
        calories: Number(input.calories) || 0,
        protein: Number(input.protein) || 0,
        carbs: Number(input.carbs) || 0,
        fat: Number(input.fat) || 0,
        date: new Date().toISOString(),
      };
      qc.setQueryData<FoodLogDTO[]>(FOOD_KEY, [optimistic, ...prev]);
      return { prev };
    },
    onError: (err, _input, ctx) => {
      if (ctx?.prev) qc.setQueryData(FOOD_KEY, ctx.prev);
      setError(err instanceof Error ? err.message : "Could not save entry");
    },
    onSuccess: () => setForm(emptyForm),
    onSettled: () => qc.invalidateQueries({ queryKey: FOOD_KEY }),
  });

  function set<K extends keyof typeof emptyForm>(key: K, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.foodName.trim()) return setError("Enter a food name");
    if (!form.quantity.trim() || !form.servingSize.trim())
      return setError("Enter quantity and serving size");
    if (!form.calories.trim()) return setError("Enter calories");
    mutation.mutate({ mealType: meal, ...form });
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
              <div className="flex flex-col gap-2">
                <Label>Meal</Label>
                <div className="grid grid-cols-2 gap-1 rounded-xl border border-border bg-secondary/40 p-1 sm:grid-cols-4">
                  {MEALS.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMeal(m.value)}
                      aria-pressed={meal === m.value}
                      className={cn(
                        segmentItem,
                        meal === m.value && segmentItemActive,
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <Label htmlFor="foodName">Food</Label>
                <Input
                  id="foodName"
                  placeholder="e.g. Grilled chicken breast"
                  value={form.foodName}
                  onChange={(e) => set("foodName", e.target.value)}
                  required
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="flex flex-col gap-2">
                  <Label htmlFor="quantity">Qty</Label>
                  <Input
                    id="quantity"
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
                  <Label htmlFor="servingSize">Serving</Label>
                  <Input
                    id="servingSize"
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
                  <Label htmlFor="servingUnit">Unit</Label>
                  <Select
                    id="servingUnit"
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
                  <Label htmlFor="calories">Calories</Label>
                  <Input
                    id="calories"
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
                  <Label htmlFor="protein">Protein</Label>
                  <Input
                    id="protein"
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
                  <Label htmlFor="carbs">Carbs</Label>
                  <Input
                    id="carbs"
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
                  <Label htmlFor="fat">Fat</Label>
                  <Input
                    id="fat"
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

              {error && (
                <p className="text-sm text-destructive" role="alert">
                  {error}
                </p>
              )}

              <Button type="submit" disabled={mutation.isPending} className="h-10">
                {mutation.isPending ? "Saving…" : "Log food"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Today summary */}
        <Card>
          <CardHeader>
            <CardTitle>Today</CardTitle>
            <CardDescription>
              {data.length === 0
                ? "Nothing logged yet."
                : `${data.length} ${data.length === 1 ? "entry" : "entries"} logged.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-5">
            <DailyTotals totals={totals} />
            <MealBreakdown logs={data} />
          </CardContent>
        </Card>
      </div>
    </div>
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
        Calories today
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

function MealBreakdown({ logs }: { logs: FoodLogDTO[] }) {
  if (logs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Your meals will appear here, grouped by breakfast, lunch, dinner, and
        snacks.
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
              {items.map((f) => (
                <li
                  key={f.id}
                  className={cn(
                    "flex items-center justify-between gap-3 border-b border-border py-2 text-sm last:border-b-0",
                    f.id.startsWith("optimistic-") && "opacity-60",
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
                  <span className="shrink-0 font-medium text-foreground">
                    {round(f.calories)} kcal
                  </span>
                </li>
              ))}
            </ul>
          </div>
        );
      })}
    </div>
  );
}
