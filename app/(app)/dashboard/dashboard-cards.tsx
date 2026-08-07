import type { ReactNode } from "react";
import Link from "next/link";
import { ArrowDown, ArrowRight, ArrowUp } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card } from "@/components/ui/card";

// A bento stat tile: label + icon up top, hero content anchored to the bottom.
export function StatCard({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: LucideIcon;
  children: ReactNode;
}) {
  return (
    <Card className="min-h-40 gap-3 p-5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div className="flex flex-1 flex-col justify-end">{children}</div>
    </Card>
  );
}

// The hero numeral — Space Grotesk, large, tight tracking.
export function StatHero({
  value,
  unit,
  className,
}: {
  value: ReactNode;
  unit?: string;
  className?: string;
}) {
  return (
    <p
      className={cn(
        "font-display text-4xl font-semibold leading-none tracking-tight",
        className,
      )}
    >
      {value}
      {unit ? (
        <span className="ml-1.5 text-base font-normal text-muted-foreground">
          {unit}
        </span>
      ) : null}
    </p>
  );
}

// Trend delta with a direction arrow. Colour is semantic (success/danger), not
// the teal accent — green when moving toward the goal, red when away.
export function Trend({
  delta,
  unit,
  tone,
}: {
  delta: number;
  unit: string;
  tone: "success" | "danger" | "muted";
}) {
  const Icon = delta > 0 ? ArrowUp : delta < 0 ? ArrowDown : ArrowRight;
  const color =
    tone === "success"
      ? "text-success"
      : tone === "danger"
        ? "text-danger"
        : "text-muted-foreground";
  return (
    <span className={cn("inline-flex items-center gap-1 text-sm font-medium", color)}>
      <Icon className="size-4" />
      {Math.abs(delta)} {unit}
      <span className="font-normal text-muted-foreground">vs last</span>
    </span>
  );
}

// Real empty state: a helpful line + a link to the page that fills the card.
export function EmptyStat({
  message,
  cta,
  href,
}: {
  message: string;
  cta: string;
  href: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{message}</p>
      <Link
        href={href}
        className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary transition-opacity hover:opacity-80"
      >
        {cta}
        <ArrowRight className="size-3.5" />
      </Link>
    </div>
  );
}

export function MacroCol({ label, grams }: { label: string; grams: number }) {
  return (
    <div>
      <p className="font-display text-2xl font-semibold leading-none tracking-tight">
        {grams}
        <span className="ml-0.5 text-xs font-normal text-muted-foreground">g</span>
      </p>
      <p className="mt-1.5 text-xs text-muted-foreground">{label}</p>
    </div>
  );
}
