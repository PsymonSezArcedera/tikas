"use client";

import * as React from "react";
import { ResponsiveContainer } from "recharts";

import { cn } from "@/lib/utils";

// Colors are passed to Recharts as CSS-var strings (e.g. var(--brand),
// var(--macro-protein)) so they follow the theme automatically — no light/dark
// flip needed in JS. Axis numerals use Space Grotesk to match the app.

export const AXIS_TICK = {
  fill: "var(--muted-foreground)",
  fontSize: 11,
  fontFamily: "var(--font-space-grotesk)",
} as const;

export const GRID_STROKE = "var(--border)";

// A sized, responsive wrapper. Give it a height via className (Recharts needs a
// bounded parent), e.g. <ChartContainer className="h-64">.
export function ChartContainer({
  className,
  children,
}: {
  className?: string;
  children: React.ReactElement;
}) {
  return (
    <div className={cn("w-full", className)}>
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
}

type TooltipRow = {
  name?: React.ReactNode;
  value?: number | string;
  color?: string;
  payload?: { fill?: string };
};

// Themed tooltip content. Pass to a Recharts <Tooltip content={...} />; Recharts
// injects `active`, `payload`, and `label` when it clones the element.
export function ChartTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter,
  hideLabel,
}: {
  active?: boolean;
  payload?: TooltipRow[];
  label?: React.ReactNode;
  labelFormatter?: (label: React.ReactNode) => React.ReactNode;
  valueFormatter?: (value: number | string, row: TooltipRow) => React.ReactNode;
  hideLabel?: boolean;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-md">
      {!hideLabel && label != null && (
        <p className="mb-1.5 font-medium text-foreground">
          {labelFormatter ? labelFormatter(label) : label}
        </p>
      )}
      <div className="flex flex-col gap-1">
        {payload.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: row.color ?? row.payload?.fill }}
            />
            {row.name != null && (
              <span className="text-muted-foreground">{row.name}</span>
            )}
            <span className="ml-auto pl-3 font-display font-semibold tabular-nums text-foreground">
              {valueFormatter && row.value != null
                ? valueFormatter(row.value, row)
                : row.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
