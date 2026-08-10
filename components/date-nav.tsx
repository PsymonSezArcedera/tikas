"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";

import { addDays } from "@/lib/day";
import { Button } from "@/components/ui/button";

/** Friendly label for an app-day key relative to today. */
export function formatDay(day: string, today: string): string {
  if (day === today) return "Today";
  if (day === addDays(today, -1)) return "Yesterday";
  const [y, m, d] = day.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

// Date control: prev/next arrows plus a native date picker under a styled pill.
// "Next" is disabled on today (no future days) and the picker is capped at today.
export function DateNav({
  day,
  today,
  onChange,
  onStep,
}: {
  day: string;
  today: string;
  onChange: (day: string) => void;
  onStep: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Previous day"
        onClick={() => onStep(-1)}
      >
        <ChevronLeft />
      </Button>
      <div className="relative">
        <span className="pointer-events-none flex h-7 items-center gap-1.5 rounded-[min(var(--radius-md),12px)] border border-border bg-background px-2.5 text-[0.8rem] font-medium text-foreground dark:border-input dark:bg-input/30">
          <CalendarDays className="size-3.5 text-muted-foreground" />
          {formatDay(day, today)}
        </span>
        <input
          type="date"
          value={day}
          max={today}
          aria-label="Pick a date"
          onChange={(e) => e.target.value && onChange(e.target.value)}
          onClick={(e) => {
            try {
              e.currentTarget.showPicker?.();
            } catch {
              /* showPicker unsupported/blocked — the field is still usable */
            }
          }}
          className="absolute inset-0 cursor-pointer opacity-0"
        />
      </div>
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        aria-label="Next day"
        disabled={day === today}
        onClick={() => onStep(1)}
      >
        <ChevronRight />
      </Button>
    </div>
  );
}
