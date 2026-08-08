"use client";

import * as React from "react";
import Link from "next/link";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { ArrowRight, Flame, PieChart as PieIcon, Scale } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  AXIS_TICK,
  ChartContainer,
  ChartTooltip,
  GRID_STROKE,
} from "@/components/ui/chart";

/* ------------------------------ shared shell ----------------------------- */

function ChartCard({
  title,
  description,
  icon: Icon,
  children,
}: {
  title: string;
  description: string;
  icon: LucideIcon;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2 text-primary">
          <Icon className="size-4" />
          <CardTitle className="text-base">{title}</CardTitle>
        </div>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function ChartEmpty({
  message,
  cta,
  href,
}: {
  message: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="flex h-56 flex-col items-center justify-center gap-2 text-center">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link
        href={href}
        className="inline-flex items-center gap-1 text-sm font-medium text-primary transition-opacity hover:opacity-80"
      >
        {cta}
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

/* ------------------------------ weight trend ----------------------------- */

export type WeightPoint = { label: string; weight: number };

export function WeightTrendChart({
  data,
  unitLabel,
  goal,
}: {
  data: WeightPoint[];
  unitLabel: string;
  goal: number | null;
}) {
  const ys = [...data.map((d) => d.weight), ...(goal != null ? [goal] : [])];
  const min = ys.length ? Math.min(...ys) : 0;
  const max = ys.length ? Math.max(...ys) : 0;
  const pad = Math.max(1, (max - min) * 0.2);
  const domain: [number, number] = [
    Math.floor(min - pad),
    Math.ceil(max + pad),
  ];

  return (
    <ChartCard
      title="Weight trend"
      description={`Your logged weight over time (${unitLabel})`}
      icon={Scale}
    >
      {data.length === 0 ? (
        <ChartEmpty
          message="No weigh-ins yet — log a few to see your trend."
          cta="Log a weigh-in"
          href="/tracking"
        />
      ) : (
        <ChartContainer className="h-56">
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
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
              minTickGap={24}
              tickMargin={8}
            />
            <YAxis
              domain={domain}
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={40}
              tickFormatter={(v) => `${v}`}
            />
            {goal != null && (
              <ReferenceLine
                y={goal}
                stroke="var(--muted-foreground)"
                strokeDasharray="5 5"
                strokeOpacity={0.7}
                label={{
                  value: `Goal ${goal}`,
                  position: "insideTopRight",
                  fill: "var(--muted-foreground)",
                  fontSize: 11,
                  fontFamily: "var(--font-space-grotesk)",
                }}
              />
            )}
            <Tooltip
              cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
              content={
                <ChartTooltip
                  valueFormatter={(v) => `${v} ${unitLabel}`}
                />
              }
            />
            <Line
              type="monotone"
              dataKey="weight"
              name="Weight"
              stroke="var(--brand)"
              strokeWidth={2}
              dot={{ r: 3, fill: "var(--brand)", strokeWidth: 0 }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}

/* ------------------------------ calorie trend ---------------------------- */

export type CaloriePoint = { label: string; calories: number };

export function CalorieTrendChart({ data }: { data: CaloriePoint[] }) {
  return (
    <ChartCard
      title="Calorie trend"
      description="Daily calories from logged food"
      icon={Flame}
    >
      {data.length === 0 ? (
        <ChartEmpty
          message="No meals logged yet — log food to see your intake over time."
          cta="Log a meal"
          href="/nutrition"
        />
      ) : (
        <ChartContainer className="h-56">
          <BarChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -8 }}>
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
              tick={AXIS_TICK}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              cursor={{ fill: "var(--muted)", opacity: 0.35 }}
              content={
                <ChartTooltip valueFormatter={(v) => `${v} kcal`} />
              }
            />
            <Bar
              dataKey="calories"
              name="Calories"
              fill="var(--brand)"
              radius={[4, 4, 0, 0]}
              maxBarSize={40}
            />
          </BarChart>
        </ChartContainer>
      )}
    </ChartCard>
  );
}

/* ----------------------------- macro donut ------------------------------- */

const MACROS = [
  { key: "protein", name: "Protein", color: "var(--macro-protein)" },
  { key: "carbs", name: "Carbs", color: "var(--macro-carbs)" },
  { key: "fat", name: "Fat", color: "var(--macro-fat)" },
] as const;

export function MacroSplitChart({
  protein,
  carbs,
  fat,
  periodLabel,
}: {
  protein: number;
  carbs: number;
  fat: number;
  periodLabel: string;
}) {
  const values: Record<string, number> = { protein, carbs, fat };
  const total = protein + carbs + fat;
  const data = MACROS.map((m) => ({
    name: m.name,
    value: values[m.key],
    color: m.color,
    pct: total > 0 ? Math.round((values[m.key] / total) * 100) : 0,
  }));

  return (
    <ChartCard
      title="Macro split"
      description={`Protein · carbs · fat — ${periodLabel}`}
      icon={PieIcon}
    >
      {total === 0 ? (
        <ChartEmpty
          message="No meals logged yet — log food to see your macro split."
          cta="Log a meal"
          href="/nutrition"
        />
      ) : (
        <div className="flex h-56 flex-col justify-center gap-5">
          <div>
            <p className="font-display text-3xl font-semibold tracking-tight">
              {Math.round(total)}
              <span className="ml-1 text-base font-normal text-muted-foreground">
                g total
              </span>
            </p>
          </div>

          {/* Stacked proportion bar: segment width = share of total grams. The
              2px gaps are the surface spacers between categories. */}
          <div className="flex h-3.5 w-full gap-0.5 overflow-hidden rounded-full">
            {data.map((d) => (
              <div
                key={d.name}
                className="h-full first:rounded-l-full last:rounded-r-full"
                style={{ width: `${d.pct}%`, background: d.color }}
                title={`${d.name}: ${Math.round(d.value)}g (${d.pct}%)`}
              />
            ))}
          </div>

          {/* Direct labels (legend + values): identity is never color-alone. */}
          <div className="grid grid-cols-3 gap-2">
            {data.map((d) => (
              <div
                key={d.name}
                className="flex flex-col gap-1 rounded-lg bg-secondary/40 px-3 py-2"
              >
                <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <span
                    className={cn("size-2.5 rounded-[3px]")}
                    style={{ background: d.color }}
                  />
                  {d.name}
                </span>
                <span className="font-display text-lg font-semibold tabular-nums leading-none">
                  {Math.round(d.value)}
                  <span className="text-xs font-normal text-muted-foreground">
                    g
                  </span>
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {d.pct}%
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </ChartCard>
  );
}
