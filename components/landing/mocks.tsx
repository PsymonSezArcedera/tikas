import {
  Check,
  Dumbbell,
  Flame,
  Lock,
  Sparkles,
  Trophy,
  TrendingUp,
} from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";
import { CoachAvatar } from "@/components/coach-avatar";

/**
 * A styled browser/app-window frame that stands in for a real product
 * screenshot. Designed so a real image drops straight in later: replace the
 * `children` with an `<img className="absolute inset-0 h-full w-full object-cover" />`
 * and nothing else changes. A soft teal glow sits behind it (the page
 * atmosphere, localized) so the frame never reads as a blank gap.
 */
export function ProductFrame({
  label,
  children,
  className,
  glow = true,
}: {
  label: string;
  children: ReactNode;
  className?: string;
  glow?: boolean;
}) {
  return (
    <div className={cn("relative", className)}>
      {/* Localized teal glow behind the frame (disabled when stacked, to avoid
          two overlapping washes). */}
      {glow ? (
        <div
          aria-hidden
          className="pointer-events-none absolute -inset-8 -z-10"
          style={{
            background:
              "radial-gradient(55% 55% at 50% 35%, color-mix(in oklch, var(--brand) 20%, transparent), transparent 72%)",
          }}
        />
      ) : null}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--card-shadow-hover)]">
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-border bg-secondary/50 px-3 py-2.5">
          <span className="flex gap-1.5">
            <span className="size-2.5 rounded-full bg-muted-foreground/25" />
            <span className="size-2.5 rounded-full bg-muted-foreground/25" />
            <span className="size-2.5 rounded-full bg-muted-foreground/25" />
          </span>
          <span className="mx-auto flex items-center gap-1.5 rounded-md bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground">
            <Lock className="size-2.5" />
            {label}
          </span>
          <span className="w-11" aria-hidden />
        </div>
        {/* Content — fixed aspect so real screenshots swap in cleanly. */}
        <div className="relative aspect-[16/10] bg-background">{children}</div>
      </div>
    </div>
  );
}

/* -------------------------------- helpers -------------------------------- */

function Sparkline({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 100 32"
      preserveAspectRatio="none"
      className={cn("h-6 w-full", className)}
      aria-hidden
    >
      <polyline
        points="0,26 14,22 28,24 42,16 56,18 70,10 84,12 100,4"
        fill="none"
        stroke="var(--brand)"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function MiniStat({
  label,
  value,
  accent,
}: {
  label: string;
  value: string;
  accent?: boolean;
}) {
  return (
    <div className="flex flex-1 flex-col justify-center gap-0.5 rounded-lg border border-border bg-secondary/40 px-2.5 py-2">
      <span className="text-[8px] uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span
        className={cn(
          "font-display text-sm font-semibold leading-none",
          accent && "text-primary",
        )}
      >
        {value}
      </span>
    </div>
  );
}

const BAR_HEIGHTS = [40, 62, 48, 78, 58, 88, 70];

function Bars({ className }: { className?: string }) {
  return (
    <div className={cn("flex h-full items-end gap-1.5", className)} aria-hidden>
      {BAR_HEIGHTS.map((h, i) => (
        <div
          key={i}
          className={cn(
            "flex-1 rounded-sm",
            i === BAR_HEIGHTS.length - 2 ? "bg-primary" : "bg-primary/35",
          )}
          style={{ height: `${h}%` }}
        />
      ))}
    </div>
  );
}

/* ------------------------------ dashboard -------------------------------- */

export function DashboardMock() {
  return (
    <div className="absolute inset-0 flex gap-2.5 p-3">
      {/* Sidebar rail */}
      <div className="hidden w-9 shrink-0 flex-col items-center gap-2.5 rounded-lg bg-secondary/50 py-2.5 sm:flex">
        <div className="flex size-5 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3} className="size-3">
            <path d="m6 14 6-6 6 6" />
            <path d="m6 19 6-6 6 6" />
          </svg>
        </div>
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={cn(
              "size-3.5 rounded",
              i === 0 ? "bg-primary/50" : "bg-muted-foreground/20",
            )}
          />
        ))}
      </div>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <div className="flex items-center justify-between">
          <div className="h-2.5 w-28 rounded-full bg-muted-foreground/25" />
          <div className="h-5 w-16 rounded-full bg-primary/15" />
        </div>

        <div className="grid flex-1 grid-cols-3 gap-2.5">
          <div className="col-span-2 flex flex-col justify-between rounded-lg border border-border bg-secondary/40 p-3">
            <span className="text-[9px] uppercase tracking-wider text-muted-foreground">
              Current weight
            </span>
            <div className="flex items-end justify-between">
              <span className="font-display text-2xl font-semibold leading-none">
                73.0
                <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                  kg
                </span>
              </span>
              <span className="flex items-center gap-0.5 text-[10px] font-medium text-primary">
                <TrendingUp className="size-3" />
                1.4
              </span>
            </div>
            <Sparkline className="mt-1" />
          </div>
          <div className="flex flex-col gap-2.5">
            <MiniStat label="Calories" value="1,840" />
            <MiniStat label="Streak" value="12 days" accent />
          </div>
        </div>

        <div className="flex h-[38%] flex-col gap-2 rounded-lg border border-border bg-secondary/40 p-3">
          <div className="flex items-center gap-1.5">
            <Flame className="size-3 text-primary" />
            <div className="h-2 w-20 rounded-full bg-muted-foreground/25" />
          </div>
          <Bars className="flex-1" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ analytics -------------------------------- */

export function AnalyticsMock() {
  return (
    <div className="absolute inset-0 flex flex-col gap-2.5 p-3">
      <div className="flex items-center gap-1.5">
        <TrendingUp className="size-3 text-primary" />
        <div className="h-2.5 w-24 rounded-full bg-muted-foreground/25" />
      </div>
      {/* Line chart card */}
      <div className="relative flex-1 overflow-hidden rounded-lg border border-border bg-secondary/40 p-3">
        <svg
          viewBox="0 0 100 40"
          preserveAspectRatio="none"
          className="h-full w-full"
          aria-hidden
        >
          {[10, 20, 30].map((y) => (
            <line
              key={y}
              x1="0"
              x2="100"
              y1={y}
              y2={y}
              stroke="var(--border)"
              strokeWidth={0.5}
              strokeDasharray="2 2"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <polyline
            points="0,32 16,28 32,30 48,20 64,22 80,12 100,8"
            fill="none"
            stroke="var(--brand)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
          {[
            [0, 32],
            [32, 30],
            [64, 22],
            [100, 8],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r={1.6} fill="var(--brand)" vectorEffect="non-scaling-stroke" />
          ))}
        </svg>
      </div>
      {/* Macro split row */}
      <div className="flex gap-2.5">
        {[
          { label: "Protein", w: "42%" },
          { label: "Carbs", w: "34%" },
          { label: "Fat", w: "24%" },
        ].map((m, i) => (
          <div
            key={m.label}
            className="flex flex-1 flex-col gap-1 rounded-lg border border-border bg-secondary/40 px-2.5 py-2"
          >
            <span className="text-[8px] uppercase tracking-wider text-muted-foreground">
              {m.label}
            </span>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted-foreground/15">
              <div
                className={cn("h-full rounded-full", i === 0 ? "bg-primary" : "bg-primary/45")}
                style={{ width: m.w }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------- workout --------------------------------- */

function ExerciseRow({
  name,
  scheme,
  pr,
}: {
  name: string;
  scheme: string;
  pr?: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-md border border-border bg-secondary/40 px-2.5 py-2">
      <div className="flex flex-col gap-1">
        <span className="text-[10px] font-medium text-foreground">{name}</span>
        <span className="text-[8px] text-muted-foreground">{scheme}</span>
      </div>
      {pr ? (
        <span className="flex items-center gap-1 rounded-full bg-primary/15 px-1.5 py-0.5 text-[8px] font-medium text-primary">
          <Trophy className="size-2.5" />
          PR
        </span>
      ) : (
        <span className="text-[9px] text-muted-foreground">›</span>
      )}
    </div>
  );
}

export function WorkoutMock() {
  return (
    <div className="absolute inset-0 flex flex-col gap-2.5 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Dumbbell className="size-3 text-primary" />
          <div className="h-2.5 w-20 rounded-full bg-muted-foreground/25" />
        </div>
        <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[8px] font-medium text-primary">
          Push · Day 1
        </span>
      </div>
      <div className="flex flex-1 flex-col gap-1.5">
        <ExerciseRow name="Bench Press" scheme="4 × 6–8 · 90s rest" pr />
        <ExerciseRow name="Overhead Press" scheme="3 × 8 · 75s rest" />
        <ExerciseRow name="Incline DB Press" scheme="3 × 10 · 60s rest" />
      </div>
      {/* PR progression */}
      <div className="rounded-lg border border-border bg-secondary/40 p-2.5">
        <div className="mb-1 flex items-center justify-between">
          <span className="text-[8px] uppercase tracking-wider text-muted-foreground">
            Bench · progression
          </span>
          <span className="font-display text-[11px] font-semibold text-primary">
            82.5 kg
          </span>
        </div>
        <Sparkline className="h-4" />
      </div>
    </div>
  );
}

/* ------------------------------- coach chat ------------------------------ */

export function ChatMock() {
  return (
    <div className="absolute inset-0 flex flex-col p-3">
      <div className="mb-2.5 flex items-center gap-2 border-b border-border pb-2.5">
        <CoachAvatar coach="VITA" className="size-6" />
        <div className="flex flex-col gap-1">
          <span className="text-[10px] font-semibold leading-none">Vita</span>
          <span className="text-[8px] text-muted-foreground">Nutrition coach</span>
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-2">
        <div className="ml-auto max-w-[75%] rounded-lg rounded-br-sm bg-primary px-2.5 py-1.5 text-[9px] leading-snug text-primary-foreground">
          I had grilled chicken and rice for lunch
        </div>
        <div className="mr-auto max-w-[80%] rounded-lg rounded-bl-sm bg-secondary px-2.5 py-1.5 text-[9px] leading-snug text-foreground">
          Nice — that&apos;s a solid, high-protein plate. Here&apos;s what I&apos;ll log:
        </div>
        {/* Food-log proposal card */}
        <div className="mr-auto w-full max-w-[86%] rounded-lg border border-border bg-card p-2.5">
          <div className="mb-1.5 flex items-center justify-between">
            <span className="text-[9px] font-medium text-foreground">
              Grilled chicken & rice
            </span>
            <span className="font-display text-[11px] font-semibold">
              520<span className="text-[8px] font-normal text-muted-foreground"> cal</span>
            </span>
          </div>
          <div className="mb-2 flex gap-1.5">
            {["P 48g", "C 46g", "F 12g"].map((m) => (
              <span
                key={m}
                className="rounded bg-secondary px-1.5 py-0.5 text-[8px] text-muted-foreground"
              >
                {m}
              </span>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <span className="flex flex-1 items-center justify-center gap-1 rounded-md bg-primary py-1 text-[8px] font-medium text-primary-foreground">
              <Check className="size-2.5" />
              Confirm & log
            </span>
            <span className="rounded-md border border-border px-2 py-1 text-[8px] text-muted-foreground">
              Edit
            </span>
          </div>
          <p className="mt-1.5 flex items-center gap-1 text-[7.5px] text-muted-foreground">
            <Sparkles className="size-2" />
            From Open Food Facts
          </p>
        </div>
      </div>
    </div>
  );
}

/* ---------------------------- hero coach chat ---------------------------- */

// A larger, deliberately legible coach exchange for the hero — makes it obvious
// at a glance that Tikas is coaches you talk to, not just a tracker. Fortis
// (strength), tying into the "Build strength" headline.
export function HeroChatMock() {
  return (
    <div className="absolute inset-0 flex flex-col p-3.5 sm:p-4">
      <div className="mb-3 flex items-center gap-2.5 border-b border-border pb-3">
        <CoachAvatar coach="FORTIS" className="size-8" />
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold leading-none sm:text-sm">
            Fortis
          </span>
          <span className="text-[10px] text-muted-foreground">
            Strength coach
          </span>
        </div>
        <span className="ml-auto flex items-center gap-1 rounded-full bg-primary/12 px-2 py-0.5 text-[9px] font-medium text-primary">
          <span className="size-1.5 rounded-full bg-primary" />
          Online
        </span>
      </div>

      <div className="flex flex-1 flex-col justify-end gap-2.5">
        <div className="mr-auto max-w-[80%] rounded-2xl rounded-bl-sm bg-secondary px-3 py-2 text-[11px] leading-relaxed text-foreground sm:text-xs">
          Leg day — let&apos;s build on last week. Ready when you are.
        </div>
        <div className="ml-auto max-w-[78%] rounded-2xl rounded-br-sm bg-primary px-3 py-2 text-[11px] leading-snug text-primary-foreground sm:text-xs">
          How heavy should I squat today?
        </div>
        <div className="mr-auto max-w-[88%] rounded-2xl rounded-bl-sm bg-secondary px-3 py-2 text-[11px] leading-relaxed text-foreground sm:text-xs">
          Work up to <span className="font-semibold text-primary">3 × 5 at 82.5&nbsp;kg</span>,
          leaving a rep in the tank. You hit 80 × 5 last week — this is your next
          step up.
        </div>
        <div className="mr-auto flex items-center gap-2 rounded-xl border border-border bg-card px-2.5 py-1.5">
          <Trophy className="size-3 text-primary" />
          <span className="text-[10px] text-muted-foreground">
            Back squat PR
          </span>
          <span className="font-display text-[11px] font-semibold">
            80 → 82.5 kg
          </span>
        </div>
      </div>
    </div>
  );
}
