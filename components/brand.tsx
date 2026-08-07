import { cn } from "@/lib/utils";

// The Tikas mark: an ember tile with an upward chevron — a nod to "matikas,"
// the upright, athletic bearing the name comes from.
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-sm",
        className
      )}
      aria-hidden
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2.75}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="size-5"
      >
        <path d="m6 14 6-6 6 6" />
        <path d="m6 19 6-6 6 6" />
      </svg>
    </span>
  );
}

export function Brand({
  className,
  showWordmark = true,
}: {
  className?: string;
  showWordmark?: boolean;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <BrandMark />
      {showWordmark ? (
        <span className="text-lg font-semibold tracking-tight">Tikas</span>
      ) : null}
    </span>
  );
}
